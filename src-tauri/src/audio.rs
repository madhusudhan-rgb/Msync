use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source};
use serde::Serialize;

/// Playback state shared with the webview. The frontend polls this a few times
/// per second, which keeps the UI in sync without an event bridge.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatus {
    pub path: Option<String>,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f32,
    pub ended: bool,
    pub error: Option<String>,
}

impl Default for AudioStatus {
    fn default() -> Self {
        Self {
            path: None,
            playing: false,
            position: 0.0,
            duration: 0.0,
            volume: 0.8,
            ended: false,
            error: None,
        }
    }
}

enum Command {
    Load {
        path: PathBuf,
        duration: f64,
        autoplay: bool,
        reply: mpsc::Sender<Result<(), String>>,
    },
    Play(mpsc::Sender<Result<(), String>>),
    Pause,
    Toggle(mpsc::Sender<Result<(), String>>),
    Seek(f64, mpsc::Sender<Result<(), String>>),
    SetVolume(f32),
    Stop,
}

struct ThreadState {
    // The device sink is kept alive for as long as the audio thread runs;
    // dropping it stops playback.
    sink: Option<MixerDeviceSink>,
    player: Option<Player>,
    loaded: Option<PathBuf>,
    duration: f64,
    volume: f32,
    error: Option<String>,
}

impl ThreadState {
    fn new() -> Self {
        Self {
            sink: None,
            player: None,
            loaded: None,
            duration: 0.0,
            volume: 0.8,
            error: None,
        }
    }

    fn ensure_sink(&mut self) -> Result<&MixerDeviceSink, String> {
        if self.sink.is_none() {
            let mut sink = DeviceSinkBuilder::open_default_sink()
                .map_err(|err| format!("No audio output available: {err}"))?;
            // Releasing the device between tracks is normal for us, so skip the
            // library's "sink dropped" warning on every track change.
            sink.log_on_drop(false);
            self.sink = Some(sink);
        }
        Ok(self.sink.as_ref().expect("sink created above"))
    }

    fn load(&mut self, path: &Path, duration: f64, autoplay: bool) -> Result<(), String> {
        let file =
            File::open(path).map_err(|err| format!("Could not open {}: {err}", path.display()))?;
        let decoder = Decoder::try_from(file).map_err(|err| {
            format!(
                "Unsupported or damaged audio file ({}): {err}",
                path.file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_else(|| path.display().to_string())
            )
        })?;

        // Trust the decoder's own duration when it has one; the metadata pass
        // can miss it for some containers. This also keeps the reported
        // position from overshooting when a track ends.
        let duration = decoder
            .total_duration()
            .map(|value| value.as_secs_f64())
            .filter(|value| *value > 0.0)
            .unwrap_or(duration);

        let sink = self.ensure_sink()?;
        let player = Player::connect_new(sink.mixer());
        player.set_volume(self.volume);
        // A fresh player starts unpaused, so pause before queueing when the
        // caller only wants to prepare a track.
        if !autoplay {
            player.pause();
        }
        player.append(decoder);

        // Assigning drops the previous player, which releases its queued
        // sources and stops the old track.
        self.player = Some(player);
        self.loaded = Some(path.to_path_buf());
        self.duration = duration;
        self.error = None;
        Ok(())
    }

    fn is_finished(&self) -> bool {
        self.player
            .as_ref()
            .map(|player| player.empty())
            .unwrap_or(true)
    }

    fn reload(&mut self, autoplay: bool) -> Result<(), String> {
        let path = self
            .loaded
            .clone()
            .ok_or_else(|| "Nothing is loaded".to_string())?;
        let duration = self.duration;
        self.load(&path, duration, autoplay)
    }

    fn play(&mut self) -> Result<(), String> {
        if self.is_finished() {
            self.reload(true)?;
        }
        if let Some(player) = &self.player {
            player.play();
        }
        Ok(())
    }

    fn pause(&mut self) {
        if let Some(player) = &self.player {
            player.pause();
        }
    }

    fn seek(&mut self, seconds: f64) -> Result<(), String> {
        let target = seconds.max(0.0);

        if self.is_finished() && self.loaded.is_some() {
            self.reload(false)?;
        }

        if let Some(player) = &self.player {
            player
                .try_seek(Duration::from_secs_f64(target))
                .map_err(|err| format!("Could not seek: {err}"))
        } else {
            Err("Nothing is loaded".to_string())
        }
    }

    fn stop(&mut self) {
        // Dropping the player stops audio immediately; dropping the sink
        // releases the output device until the next track is loaded.
        self.player = None;
        self.sink = None;
        self.loaded = None;
        self.duration = 0.0;
        self.error = None;
    }

    fn status(&self) -> AudioStatus {
        let mut status = AudioStatus {
            path: self
                .loaded
                .as_ref()
                .map(|path| path.to_string_lossy().to_string()),
            duration: self.duration,
            volume: self.volume,
            error: self.error.clone(),
            ..AudioStatus::default()
        };

        if let Some(player) = &self.player {
            let ended = self.loaded.is_some() && player.empty();
            let paused = player.is_paused();
            let mut position = player.get_pos().as_secs_f64();

            if ended {
                position = self.duration;
            }
            if self.duration > 0.0 {
                position = position.min(self.duration);
            }

            status.position = position.max(0.0);
            status.playing = self.loaded.is_some() && !paused && !ended;
            status.ended = ended;
        }

        status
    }
}

fn publish(status: &Arc<Mutex<AudioStatus>>, next: AudioStatus) {
    if let Ok(mut guard) = status.lock() {
        *guard = next;
    }
}

fn engine_loop(rx: mpsc::Receiver<Command>, shared: Arc<Mutex<AudioStatus>>) {
    let mut state = ThreadState::new();

    loop {
        match rx.recv_timeout(Duration::from_millis(150)) {
            Ok(Command::Load {
                path,
                duration,
                autoplay,
                reply,
            }) => {
                let result = state.load(&path, duration, autoplay);
                if let Err(err) = &result {
                    state.error = Some(err.clone());
                }
                let _ = reply.send(result);
            }
            Ok(Command::Play(reply)) => {
                let result = state.play();
                if let Err(err) = &result {
                    state.error = Some(err.clone());
                }
                let _ = reply.send(result);
            }
            Ok(Command::Pause) => state.pause(),
            Ok(Command::Toggle(reply)) => {
                let paused = state
                    .player
                    .as_ref()
                    .map(|player| player.is_paused())
                    .unwrap_or(true);
                let result = if paused {
                    state.play()
                } else {
                    state.pause();
                    Ok(())
                };
                if let Err(err) = &result {
                    state.error = Some(err.clone());
                }
                let _ = reply.send(result);
            }
            Ok(Command::Seek(seconds, reply)) => {
                let result = state.seek(seconds);
                if let Err(err) = &result {
                    state.error = Some(err.clone());
                }
                let _ = reply.send(result);
            }
            Ok(Command::SetVolume(volume)) => {
                state.volume = volume.clamp(0.0, 1.0);
                if let Some(player) = &state.player {
                    player.set_volume(state.volume);
                }
            }
            Ok(Command::Stop) => state.stop(),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }

        publish(&shared, state.status());
    }
}

/// Handle to the dedicated audio thread. Commands are sent over a channel so
/// the (non-Send) audio stream never has to leave its own thread.
pub struct AudioHandle {
    tx: Mutex<mpsc::Sender<Command>>,
    status: Arc<Mutex<AudioStatus>>,
}

impl AudioHandle {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let status = Arc::new(Mutex::new(AudioStatus::default()));
        let thread_status = Arc::clone(&status);

        thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || engine_loop(rx, thread_status))
            .expect("failed to spawn audio engine thread");

        Self {
            tx: Mutex::new(tx),
            status,
        }
    }

    fn send(&self, command: Command) -> Result<(), String> {
        self.tx
            .lock()
            .map_err(|_| "Audio engine is unavailable".to_string())?
            .send(command)
            .map_err(|_| "Audio engine stopped unexpectedly".to_string())
    }

    fn request<F>(&self, make: F) -> Result<(), String>
    where
        F: FnOnce(mpsc::Sender<Result<(), String>>) -> Command,
    {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.send(make(reply_tx))?;
        reply_rx
            .recv_timeout(Duration::from_secs(15))
            .map_err(|_| "Audio engine did not respond".to_string())?
    }

    pub fn load(&self, path: String, duration: f64, autoplay: bool) -> Result<(), String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.send(Command::Load {
            path: PathBuf::from(path),
            duration,
            autoplay,
            reply: reply_tx,
        })?;
        reply_rx
            .recv_timeout(Duration::from_secs(15))
            .map_err(|_| "Audio engine did not respond".to_string())?
    }

    pub fn play(&self) -> Result<(), String> {
        self.request(Command::Play)
    }

    pub fn toggle(&self) -> Result<(), String> {
        self.request(Command::Toggle)
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        self.request(|reply| Command::Seek(seconds, reply))
    }

    pub fn pause(&self) -> Result<(), String> {
        self.send(Command::Pause)
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.send(Command::SetVolume(volume))
    }

    pub fn stop(&self) -> Result<(), String> {
        self.send(Command::Stop)
    }

    pub fn status(&self) -> AudioStatus {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn audio_files() -> Vec<PathBuf> {
        let Some(dir) = std::env::var_os("MUSICPLAYER_TEST_MEDIA").map(PathBuf::from) else {
            return Vec::new();
        };
        let Ok(entries) = std::fs::read_dir(dir) else {
            return Vec::new();
        };
        let mut files: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| {
                        crate::library::AUDIO_EXTENSIONS
                            .contains(&ext.to_ascii_lowercase().as_str())
                    })
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        files
    }

    /// Exercises the real audio thread against real files. Set
    /// MUSICPLAYER_TEST_MEDIA to a folder of media to run it; otherwise the
    /// test is skipped so `cargo test` still works without speakers.
    #[test]
    fn engine_loads_plays_seeks_and_finishes() {
        let files = audio_files();
        if files.is_empty() {
            eprintln!("skipping audio engine test: MUSICPLAYER_TEST_MEDIA is not set");
            return;
        }

        let engine = AudioHandle::new();

        for file in &files {
            let name = file
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            engine
                .load(file.to_string_lossy().to_string(), 0.0, true)
                .unwrap_or_else(|err| panic!("{name}: {err}"));

            thread::sleep(Duration::from_millis(900));
            let status = engine.status();
            assert!(status.error.is_none(), "{name}: {:?}", status.error);
            assert!(status.duration > 0.2, "{name}: no duration reported");
            assert!(status.playing, "{name}: not playing");
            assert!(
                status.position > 0.2,
                "{name}: position did not advance ({})",
                status.position
            );

            engine
                .seek(3.0)
                .unwrap_or_else(|err| panic!("{name}: seek failed: {err}"));
            thread::sleep(Duration::from_millis(250));
            let seeked = engine.status();
            assert!(
                seeked.position >= 2.5,
                "{name}: expected to seek near 3s, got {}",
                seeked.position
            );

            engine.pause().unwrap_or_else(|err| panic!("{name}: {err}"));
            thread::sleep(Duration::from_millis(250));
            assert!(!engine.status().playing, "{name}: did not pause");

            engine.stop().unwrap_or_else(|err| panic!("{name}: {err}"));
            thread::sleep(Duration::from_millis(250));
            assert!(
                engine.status().path.is_none(),
                "{name}: stop did not clear state"
            );
        }

        // Natural end of the last file: seek close to the end and wait for the
        // source to drain, which is what drives auto-advance in the UI.
        let file = files.last().expect("at least one file");
        engine
            .load(file.to_string_lossy().to_string(), 0.0, true)
            .expect("load last file");
        thread::sleep(Duration::from_millis(500));
        let duration = engine.status().duration;
        engine.seek((duration - 0.4).max(0.0)).expect("seek to end");
        thread::sleep(Duration::from_millis(1600));
        let ended = engine.status();
        assert!(ended.ended, "engine did not report the end of the track");
        assert!(
            (ended.position - duration).abs() < 0.2,
            "end position was {}",
            ended.position
        );
    }
}
