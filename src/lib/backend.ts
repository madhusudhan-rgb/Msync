import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  getBrowserTracks,
  putBrowserTrack,
  removeBrowserTrack,
} from './browserStore';
import type { AudioStatus, MediaKind, RepeatMode, Track, ViewName } from './types';

/** True when running inside the Tauri shell (native window or mobile app). */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Mobile webviews cannot hand Rust a normal file path (Android/iOS return
 * content URIs), so there we use the webview's own <audio>/<video> pipeline.
 * Desktop uses the Rust engine, which decodes far more formats.
 */
export const isMobile =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isNativeMedia = isTauri && !isMobile;

const AUDIO_EXTENSIONS = [
  'mp3', 'mp2', 'mp1', 'flac', 'wav', 'wave', 'ogg', 'oga',
  'm4a', 'm4b', 'aac', 'alac', 'aif', 'aiff', 'caf', 'mka',
];

const VIDEO_EXTENSIONS = [
  'mp4', 'm4v', 'webm', 'mkv', 'mov', 'ogv', 'avi', 'mpg',
  'mpeg', '3gp', 'ts', 'wmv', 'flv',
];

const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

const KIND_BY_EXT = new Map<string, MediaKind>([
  ...AUDIO_EXTENSIONS.map((ext) => [ext, 'audio'] as [string, MediaKind]),
  ...VIDEO_EXTENSIONS.map((ext) => [ext, 'video'] as [string, MediaKind]),
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function titleFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

export function scanPaths(paths: string[]): Promise<Track[]> {
  return invoke<Track[]>('scan_paths', { paths });
}

/** Copies added media into the app's own folder so it survives later moves. */
export function importPaths(paths: string[]): Promise<Track[]> {
  if (!isNativeMedia) return scanPaths(paths);
  return invoke<Track[]>('import_paths', { paths });
}

/** Last-resort video source when the asset URL cannot be decoded. */
export function mediaDataUrl(path: string): Promise<string> {
  return invoke<string>('media_data_url', { path });
}

/** Media paths passed on the command line (e.g. `musicplayer ~/Music`). */
export async function getInitialPaths(): Promise<string[]> {
  if (!isTauri) return [];
  try {
    return await invoke<string[]>('initial_paths');
  } catch {
    return [];
  }
}

/**
 * The whole library lives in one JSON file inside the app data directory on
 * desktop, so it survives cache clears and webview storage resets. Browsers
 * keep the file blobs in IndexedDB instead (see browserStore.ts).
 */
export interface SavedLibrarySnapshot {
  library: Track[];
  folders: string[];
  looseFiles: string[];
  currentId: string | null;
  detail?: string | null;
  volume?: number;
  muted?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
  view?: ViewName;
}

export async function loadSavedLibrary(): Promise<SavedLibrarySnapshot | null> {
  if (!isNativeMedia) return null;
  try {
    const snapshot = await invoke<SavedLibrarySnapshot | null>('load_saved_library');
    return snapshot && Array.isArray(snapshot.library) ? snapshot : null;
  } catch {
    return null;
  }
}

export function saveSavedLibrary(snapshot: SavedLibrarySnapshot): Promise<void> {
  if (!isNativeMedia) return Promise.resolve();
  return invoke('save_saved_library', { snapshot })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Opens the native picker; in the browser preview this uses a file input. */
export async function pickFiles(): Promise<Track[]> {
  if (isNativeMedia) {
    const selection = await open({
      multiple: true,
      title: 'Add music or video',
      filters: [{ name: 'Media', extensions: MEDIA_EXTENSIONS }],
    });
    const paths = Array.isArray(selection) ? selection : selection ? [selection] : [];
    return paths.length ? importPaths(paths) : [];
  }
  const { tracks } = await pickBrowserFiles(false);
  return tracks;
}

export async function pickFolder(): Promise<{ folder: string; tracks: Track[] } | null> {
  if (isNativeMedia) {
    const selection = await open({
      directory: true,
      multiple: false,
      title: 'Add a music folder',
    });
    const folder = typeof selection === 'string' ? selection : null;
    if (!folder) return null;
    return { folder, tracks: await importPaths([folder]) };
  }

  const { tracks, folder } = await pickBrowserFiles(true);
  return { folder: folder ?? 'Local files', tracks };
}

export function mediaUrl(path: string): string {
  return isNativeMedia ? convertFileSrc(path) : path;
}

const artCache = new Map<string, Promise<string | null>>();

export function loadArtwork(path: string): Promise<string | null> {
  if (!isNativeMedia) return Promise.resolve(null);
  const cached = artCache.get(path);
  if (cached) return cached;

  const request = invoke<string | null>('track_art', { path }).catch(() => null);
  artCache.set(path, request);
  return request;
}

/* ------------------------------------------------------------------ */
/* Browser preview fallback                                            */
/* ------------------------------------------------------------------ */

function browserTrack(file: File): Track | null {
  const ext = extensionOf(file.name);
  const kind = KIND_BY_EXT.get(ext);
  if (!kind) return null;
  const relative =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

  return {
    // lastModified changes when a browser re-adds the same bytes over RPC, so
    // keep the id stable from name + size to avoid duplicate library entries.
    id: `browser:${relative}:${file.size}`,
    path: URL.createObjectURL(file),
    title: titleFromName(file.name),
    artist: null,
    album: null,
    duration: 0,
    kind,
    ext,
    size: file.size,
    modified: file.lastModified,
    track: null,
    disc: null,
  };
}

function withoutPath(track: Track): Omit<Track, 'path'> {
  const copy: Partial<Track> = { ...track };
  delete copy.path;
  return copy as Omit<Track, 'path'>;
}

/**
 * Reads duration in the browser preview. Native builds get this from the Rust
 * scanner; here we ask an <audio>/<video> element for its metadata.
 */
function readMediaDuration(file: File, kind: MediaKind): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };

    const url = URL.createObjectURL(file);
    const element = document.createElement(kind === 'video' ? 'video' : 'audio');
    element.preload = 'metadata';
    element.onloadedmetadata = () =>
      done(Number.isFinite(element.duration) ? element.duration : 0);
    element.onerror = () => done(0);
    window.setTimeout(() => done(0), 5000);
    element.src = url;
  });
}

/** Reads dropped/picked files and keeps their bytes in IndexedDB. */
export async function tracksFromBrowserFiles(files: File[]): Promise<Track[]> {
  const pairs = files
    .map((file) => ({ file, track: browserTrack(file) }))
    .filter((pair): pair is { file: File; track: Track } => pair.track !== null);

  await Promise.all(
    pairs.map(async ({ file, track }) => {
      const duration = await readMediaDuration(file, track.kind);
      if (duration > 0) track.duration = duration;
    }),
  );
  await Promise.all(
    pairs.map(({ file, track }) =>
      putBrowserTrack({ id: track.id, blob: file, track: withoutPath(track) }),
    ),
  );
  return pairs.map((pair) => pair.track);
}

/** Rebuilds playable blob URLs for files stored by an earlier session. */
export async function restoreBrowserTracks(): Promise<Track[]> {
  const stored = await getBrowserTracks();
  return stored.map(({ blob, track }) => ({
    ...track,
    path: URL.createObjectURL(blob),
  }));
}

export function forgetBrowserTrack(id: string): void {
  if (id.startsWith('browser:')) void removeBrowserTrack(id);
}

async function pickBrowserFiles(directory: boolean): Promise<{
  tracks: Track[];
  folder: string | null;
}> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,video/*';
    input.style.display = 'none';
    if (directory) {
      input.setAttribute('webkitdirectory', '');
    }

    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []);
      const tracks = await tracksFromBrowserFiles(files);
      const relative = files[0]?.webkitRelativePath;
      input.remove();
      resolve({
        tracks,
        folder: directory && relative ? (relative.split('/')[0] ?? null) : null,
      });
    });

    document.body.appendChild(input);
    input.click();
  });
}

/* ------------------------------------------------------------------ */
/* Audio engine                                                        */
/* ------------------------------------------------------------------ */

export interface AudioApi {
  load(path: string, duration: number, autoplay: boolean): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<AudioStatus>;
}

const nativeAudio: AudioApi = {
  load: (path, duration, autoplay) => invoke('audio_load', { path, duration, autoplay }),
  play: () => invoke('audio_play'),
  pause: () => invoke('audio_pause'),
  seek: (position) => invoke('audio_seek', { position }),
  setVolume: (volume) => invoke('audio_set_volume', { volume }),
  stop: () => invoke('audio_stop'),
  status: () => invoke<AudioStatus>('audio_status'),
};

let browserAudioElement: HTMLAudioElement | null = null;
let browserAudioPath: string | null = null;
let browserAudioError: string | null = null;

function browserAudio(): HTMLAudioElement {
  if (!browserAudioElement) {
    const element = new Audio();
    element.preload = 'auto';
    element.addEventListener('error', () => {
      browserAudioError =
        'This browser cannot decode the file. Open the desktop app for full format support.';
    });
    browserAudioElement = element;
  }
  return browserAudioElement;
}

const browserAudioApi: AudioApi = {
  async load(path, _duration, autoplay) {
    const element = browserAudio();
    browserAudioError = null;
    browserAudioPath = path;
    element.src = path;
    element.load();
    if (autoplay) {
      await element.play();
    }
  },
  async play() {
    await browserAudio().play();
  },
  async pause() {
    browserAudio().pause();
  },
  async seek(position) {
    const element = browserAudio();
    if (Number.isFinite(element.duration)) {
      element.currentTime = Math.max(0, Math.min(position, element.duration));
    } else {
      element.currentTime = Math.max(0, position);
    }
  },
  async setVolume(volume) {
    browserAudio().volume = Math.max(0, Math.min(1, volume));
  },
  async stop() {
    const element = browserAudio();
    element.pause();
    element.removeAttribute('src');
    element.load();
    browserAudioPath = null;
  },
  async status() {
    const element = browserAudio();
    return {
      path: browserAudioPath,
      playing: !element.paused && !element.ended,
      position: element.currentTime || 0,
      duration: Number.isFinite(element.duration) ? element.duration : 0,
      volume: element.volume,
      ended: element.ended,
      error: browserAudioError,
    };
  },
};

export const audio: AudioApi = isNativeMedia ? nativeAudio : browserAudioApi;

/** Native file-drop events (Tauri intercepts HTML5 drops by default). */
export async function subscribeToFileDrops(
  onPaths: (paths: string[]) => void,
  onHover?: (hovering: boolean) => void,
): Promise<() => void> {
  if (!isNativeMedia) return () => {};

  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      onHover?.(false);
      onPaths(event.payload.paths);
    } else {
      onHover?.(event.payload.type !== 'leave');
    }
  });
}
