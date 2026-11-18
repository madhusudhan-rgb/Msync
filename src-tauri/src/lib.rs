mod audio;
mod library;

use audio::AudioHandle;
use library::LibraryState;
use tauri::State;

#[tauri::command]
fn audio_load(
    state: State<'_, AudioHandle>,
    path: String,
    duration: f64,
    autoplay: bool,
) -> Result<(), String> {
    state.load(path, duration, autoplay)
}

#[tauri::command]
fn audio_play(state: State<'_, AudioHandle>) -> Result<(), String> {
    state.play()
}

#[tauri::command]
fn audio_pause(state: State<'_, AudioHandle>) -> Result<(), String> {
    state.pause()
}

#[tauri::command]
fn audio_toggle(state: State<'_, AudioHandle>) -> Result<(), String> {
    state.toggle()
}

#[tauri::command]
fn audio_seek(state: State<'_, AudioHandle>, position: f64) -> Result<(), String> {
    state.seek(position)
}

#[tauri::command]
fn audio_set_volume(state: State<'_, AudioHandle>, volume: f32) -> Result<(), String> {
    state.set_volume(volume)
}

#[tauri::command]
fn audio_stop(state: State<'_, AudioHandle>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn audio_status(state: State<'_, AudioHandle>) -> audio::AudioStatus {
    state.status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("lofty", log::LevelFilter::Warn)
                .build(),
        )
        .manage(AudioHandle::new())
        .manage(LibraryState::new())
        .invoke_handler(tauri::generate_handler![
            audio_load,
            audio_play,
            audio_pause,
            audio_toggle,
            audio_seek,
            audio_set_volume,
            audio_stop,
            audio_status,
            library::scan_paths,
            library::import_paths,
            library::media_data_url,
            library::track_art,
            library::clear_art_cache,
            library::initial_paths,
            library::load_saved_library,
            library::save_saved_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
