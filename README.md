
# Msync

A small, fast music and video player for **Windows, Linux, macOS, Android, and iOS**, built with a React + TypeScript frontend and a Tauri 2 / Rust backend.

The idea is simple: point it at your files, press play, and stay out of the way. No accounts, no cloud, no database — your library lives on your machine.

<p align="center">
  <em>Library · Albums · Artists · Videos · Queue · Now playing</em>
</p>

## Features

- **Plays real formats.** Audio is decoded in Rust with [Symphonia](https://github.com/pdeljanov/Symphonia) through [rodio](https://github.com/RustAudio/rodio), not by the platform webview: MP3, FLAC, WAV, OGG/Vorbis, M4A/AAC/ALAC, AIFF, CAF, MP2/MP1, MKA and more.
- **Videos too.** MP4 (H.264), WebM, MOV and whatever else your system webview can decode.
- **Folder library + drag and drop.** Add a folder once, rescan it later. Drop files or folders straight onto the window.
- **Proper metadata.** Titles, artists, albums, track/disc numbers and durations from embedded tags, plus cover art from the file, a `cover.jpg`/`folder.png` beside it, or a public artwork lookup (Deezer, then iTunes) that is cached locally.
- **Spotify-style, but minimal.** Just the library, a search field, and the player. Album/artist views, sortable track lists, queue, keyboard shortcuts, dark UI.
- **Player basics done right.** Play/pause, next/previous, seek, volume, mute, shuffle, repeat off/all/one, auto-advance.
- **No database.** Added files are copied into the app's own local library folder; the list and preferences are stored in a JSON file in app data, with a `localStorage` backup on desktop and IndexedDB for browser previews.
- **Open with.** `musicplayer ~/Music` (or a file) loads it on launch.

The only network requests are artwork lookups for tracks without local cover art; they send the artist and album names and cache the result. Your files and preferences never leave the device.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek 5 seconds |
| `Shift` + `←` / `→` | Previous / next track |
| `↑` / `↓` | Volume |
| `M` | Mute |
| `S` | Shuffle |
| `R` | Cycle repeat mode |
| `N` / `P` | Next / previous |
| `/` | Focus search |
| `Esc` | Clear search / dismiss a message |

## Getting started

You need [Node.js 20+](https://nodejs.org) and [Rust](https://rustup.rs). Then:

```bash
npm install
npm run app
```

`npm run app` starts Vite and the Tauri window with hot reload. To build a distributable:

```bash
npm run app:build
```

### Linux prerequisites

Tauri and the audio backend need the WebKitGTK and ALSA development headers. On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libasound2-dev
```

Fedora, Arch and the rest: see the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

`dev.sh` is a convenience wrapper around `cargo tauri dev` that sets a headless-friendly GSettings backend and warns about missing ALSA headers.

### Android and iOS

The UI is responsive and the Tauri project is mobile-ready, but mobile needs extra toolchains:

```bash
npm run tauri android init   # needs Android Studio + NDK
npm run tauri ios init       # needs Xcode
npm run tauri android dev
npm run tauri ios dev
```

On mobile, the app uses the system webview's audio/video pipeline rather than the Rust decoder, because Android and iOS hand out `content://` URIs instead of filesystem paths. Mobile format support is therefore whatever the OS supports; blob-backed tracks are stored in IndexedDB.

## Using it

1. Press **Add music** to pick a folder, or **Add files** to pick individual tracks.
2. Or drag and drop files/folders onto the window.
3. Switch between **Home / Songs / Albums / Artists / Videos / Queue** in the sidebar.
4. Rescan from the refresh icon after adding files to a folder outside the app.

Supported audio extensions: `mp3`, `mp2`, `mp1`, `flac`, `wav`, `ogg`, `oga`, `m4a`, `m4b`, `aac`, `alac`, `aif`, `aiff`, `caf`, `mka`.
Supported video extensions: `mp4`, `m4v`, `webm`, `mkv`, `mov`, `ogv`, `avi`, `mpg`, `mpeg`, `3gp`, `ts`, `wmv`, `flv` (actual playback depends on platform codecs).

## Architecture

```
src/                    React UI (Vite)
  components/           Sidebar, header, track list, player bar, views, video surface
  lib/backend.ts        Tauri IPC + browser/mobile fallback adapter
  lib/player.ts         Library + playback store (localStorage persistence)
  lib/utils.ts          formatting, grouping, sorting
src-tauri/
  src/audio.rs          Native decode + playback on a dedicated audio thread
  src/library.rs        Folder scanning, metadata, artwork thumbnails
  src/lib.rs            Tauri commands and app setup
  capabilities/         Tauri permissions
```

Audio playback runs on its own thread behind a command channel, because the OS audio stream cannot be shared across threads. The frontend polls `audio_status` at 250 ms; video is driven by a single `<video>` element that moves between the player bar and the immersive stage.

The asset protocol is enabled for app data, cache, and home paths so video files can be streamed with range requests. If a webview cannot open a local file through the asset URL, the player retries the same MP4/WebM bytes through a data URL before reporting a codec error. The app only loads local media and has no remote content; tighten `app.security.assetProtocol.scope` in `src-tauri/tauri.conf.json` if you add remote pages.

## Scripts

| Command | Description |
| --- | --- |
|`If you encounter a GLIB error of any sort use GDK_BACKEND=x11 npm run app or use cargo tauri dev`|
| `npm run app/cargo tauri dev` | Run the desktop app with hot reload |
| `npm run dev` | Run only the web frontend (browser preview) |
| `npm run build` | Type-check and build the frontend |
| `npm run app:build` | Build the native app/bundles |
| `npm run lint` | ESLint |

## License

MIT — see [LICENSE](./LICENSE).
>>>>>>> 3a78e3c (COnversion to tauri and react)
