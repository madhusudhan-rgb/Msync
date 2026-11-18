# Musicplayer — agent notes

This project is a **Tauri 2 + React 19 + Vite + TypeScript** app. The old Expo/React Native version has been removed.

Before changing framework APIs, read the current docs:

- Tauri 2: https://v2.tauri.app/
- React 19: https://react.dev/
- Vite: https://vite.dev/

## Ground rules

- Frontend: `src/`. Backend: `src-tauri/`. Media metadata and decoding live in Rust; UI state lives in React.
- Artwork: embedded tag art → `cover.*` beside the file → online lookup (Deezer, then iTunes), cached under the app cache dir. Lookups must fail soft and never block playback.
- No database or server. Added media is copied into the app data `media/` folder; the library snapshot lives in `library.json` with `localStorage`/IndexedDB as preview fallbacks (see `src/lib/player.ts`, `src-tauri/src/library.rs`).
- UI icons come from `react-icons/io5` via `src/components/Icons.tsx`; only the packaged app icons remain as image assets in `src-tauri/icons/`.
- Audio goes through the Rust engine (`src-tauri/src/audio.rs`) on desktop. Do not move audio playback into the webview on desktop; format support depends on it.
- Video uses the single `<video>` element in `VideoSurface.tsx` via the Tauri asset protocol, with a data-URL fallback for codec/protocol failures. Keep it mounted across view changes.
- Keep `npm run lint`, `npm run build`, and `cargo check` (in `src-tauri`) passing.
- When adding a Tauri command, register it in `src-tauri/src/lib.rs` and add a wrapper in `src/lib/backend.ts`. Keep the browser/mobile fallback working.
- Linux builds need `libwebkit2gtk-4.1-dev` and `libasound2-dev`; see README.
