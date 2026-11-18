import * as backend from './backend';
import type { AudioStatus, PlayerState, RepeatMode, Track, ViewName } from './types';
import { shuffleTracks } from './utils';

const STORAGE_KEY = 'musicplayer.state.v1';

type PersistedState = Pick<
  PlayerState,
  'library' | 'folders' | 'looseFiles' | 'volume' | 'muted' | 'shuffle' | 'repeat' | 'view' | 'detail'
> & { currentId: string | null };

const PERSISTED_KEYS = new Set<string>([
  'library',
  'folders',
  'looseFiles',
  'volume',
  'muted',
  'shuffle',
  'repeat',
  'view',
  'detail',
  'current',
]);

const VIEW_NAMES: ViewName[] = [
  'home', 'songs', 'albums', 'artists', 'videos', 'queue', 'now', 'album', 'artist',
];

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Something went wrong while playing this file.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === 'string' &&
    typeof track.path === 'string' &&
    typeof track.title === 'string' &&
    (track.kind === 'audio' || track.kind === 'video')
  );
}

function readPersisted(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const library = Array.isArray(parsed.library)
      ? parsed.library
          .filter(isTrack)
          .filter((track) => backend.isNativeMedia || !track.path.startsWith('blob:'))
      : [];
    const folders = Array.isArray(parsed.folders)
      ? parsed.folders.filter((folder): folder is string => typeof folder === 'string')
      : [];
    const looseFiles = Array.isArray(parsed.looseFiles)
      ? parsed.looseFiles.filter((path): path is string => typeof path === 'string')
      : [];
    const repeat: RepeatMode =
      parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off';
    const volume = typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : 0.8;
    const views = VIEW_NAMES;

    return {
      library,
      folders,
      looseFiles,
      volume,
      muted: Boolean(parsed.muted),
      shuffle: Boolean(parsed.shuffle),
      repeat,
      view: parsed.view && views.includes(parsed.view) ? parsed.view : 'home',
      detail: typeof parsed.detail === 'string' ? parsed.detail : null,
      currentId: typeof parsed.currentId === 'string' ? parsed.currentId : null,
    };
  } catch {
    return {};
  }
}

class PlayerStore {
  private state: PlayerState;
  private listeners = new Set<() => void>();
  private initialized = false;
  private playToken = 0;
  private pollToken = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private video: HTMLVideoElement | null = null;
  private pendingCurrentId: string | null = null;

  constructor() {
    const saved = readPersisted();
    this.pendingCurrentId = saved.currentId ?? null;
    const library = saved.library ?? [];
    const currentId = saved.library ? saved.currentId ?? null : null;
    const current = currentId ? library.find((track) => track.id === currentId) ?? null : null;
    const queueIndex = current ? Math.max(0, library.findIndex((track) => track.id === current.id)) : -1;

    this.state = {
      library,
      folders: saved.folders ?? [],
      looseFiles: saved.looseFiles ?? [],
      view: saved.view ?? 'home',
      detail: saved.detail ?? null,
      queue: current ? library : [],
      queueIndex,
      current,
      playing: false,
      position: 0,
      duration: current?.duration ?? 0,
      volume: saved.volume ?? 0.8,
      muted: saved.muted ?? false,
      shuffle: saved.shuffle ?? false,
      repeat: saved.repeat ?? 'off',
      videoSrc: current?.kind === 'video' ? backend.mediaUrl(current.path) : null,
      search: '',
      scanning: false,
      error: null,
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.saveNow);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.saveNow();
      });
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PlayerState => this.state;

  private set(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
    // Position, playing, search and scanning change many times per second while
    // a track plays; only persist the fields that are actually stored.
    if (Object.keys(patch).some((key) => PERSISTED_KEYS.has(key))) {
      this.scheduleSave();
    }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(this.saveNow, 800);
  }

  private saveNow = () => {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const { library, folders, looseFiles, volume, muted, shuffle, repeat, view, detail, current } =
      this.state;
    const persistable = backend.isNativeMedia
      ? library
      : library.filter((track) => !track.path.startsWith('blob:'));
    const payload: backend.SavedLibrarySnapshot = {
      library: persistable,
      folders,
      looseFiles,
      volume,
      muted,
      shuffle,
      repeat,
      view,
      detail,
      // Blob tracks are restored from IndexedDB, but their ids stay stable.
      currentId: current?.id ?? null,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be full or unavailable (private mode); playback still works.
    }
    // The desktop app also writes a plain JSON file outside webview storage,
    // so clearing the cache never loses the library.
    void backend.saveSavedLibrary(payload);
  };

  setError(message: string) {
    this.set({ error: message });
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.errorTimer = null;
      this.set({ error: null });
    }, 6000);
  }

  clearError = () => {
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
    this.set({ error: null });
  };

  private restoreSaved(saved: backend.SavedLibrarySnapshot) {
    const library = Array.isArray(saved.library) ? saved.library.filter(isTrack) : [];
    const currentId = typeof saved.currentId === 'string' ? saved.currentId : null;
    const current = currentId ? library.find((track) => track.id === currentId) ?? null : null;
    const index = current ? library.findIndex((track) => track.id === current.id) : -1;
    const repeat: RepeatMode =
      saved.repeat === 'all' || saved.repeat === 'one' ? saved.repeat : 'off';

    this.set({
      library,
      folders: Array.isArray(saved.folders)
        ? saved.folders.filter((folder): folder is string => typeof folder === 'string')
        : [],
      looseFiles: Array.isArray(saved.looseFiles)
        ? saved.looseFiles.filter((path): path is string => typeof path === 'string')
        : [],
      current,
      queue: current ? library : [],
      queueIndex: index >= 0 ? index : -1,
      duration: current?.duration ?? 0,
      videoSrc: current?.kind === 'video' ? backend.mediaUrl(current.path) : null,
      view: saved.view && VIEW_NAMES.includes(saved.view) ? saved.view : this.state.view,
      detail: typeof saved.detail === 'string' ? saved.detail : null,
      volume: typeof saved.volume === 'number' ? clamp(saved.volume, 0, 1) : this.state.volume,
      muted: typeof saved.muted === 'boolean' ? saved.muted : this.state.muted,
      shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : this.state.shuffle,
      repeat,
    });
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (backend.isNativeMedia) {
      const saved = await backend.loadSavedLibrary();
      if (saved && (saved.library.length || saved.folders.length || saved.looseFiles.length)) {
        this.restoreSaved(saved);
      } else {
        // First launch on this build: migrate any webview-stored library into
        // real local copies, then write the on-disk snapshot.
        const legacy = readPersisted();
        const paths = (legacy.library ?? [])
          .map((track) => track.path)
          .filter((path) => !path.startsWith('blob:'));
        const imported = paths.length ? await backend.importPaths(paths) : [];
        if (imported.length) {
          const wantedId = legacy.currentId ?? null;
          const current =
            (wantedId ? imported.find((track) => track.id === wantedId) : null) ?? null;
          this.set({
            library: imported,
            folders: legacy.folders ?? [],
            looseFiles: legacy.looseFiles ?? [],
            current,
            queue: current ? imported : [],
            queueIndex: current ? imported.findIndex((track) => track.id === current.id) : -1,
            duration: current?.duration ?? 0,
            videoSrc: current?.kind === 'video' ? backend.mediaUrl(current.path) : null,
          });
          this.pendingCurrentId = null;
        }
        this.saveNow();
      }
    } else {
      // Browser preview files live in IndexedDB because blob: URLs die on reload.
      const restored = await backend.restoreBrowserTracks();
      if (restored.length) this.merge(restored);
    }

    if (!this.state.current && this.pendingCurrentId) {
      const current =
        this.state.library.find((track) => track.id === this.pendingCurrentId) ?? null;
      if (current) {
        const index = this.state.library.findIndex((track) => track.id === current.id);
        this.set({
          current,
          queue: this.state.library,
          queueIndex: Math.max(0, index),
          duration: current.duration,
          videoSrc: current.kind === 'video' ? backend.mediaUrl(current.path) : null,
        });
      }
    }
    this.pendingCurrentId = null;

    await backend.audio.setVolume(this.effectiveVolume()).catch(() => {});
    if (this.video) this.video.volume = this.effectiveVolume();

    const current = this.state.current;
    if (current?.kind === 'audio') {
      try {
        await backend.audio.load(current.path, current.duration, false);
      } catch (error) {
        this.setError(errorMessage(error));
      }
    }
  }

  /* ---------------------------- library ---------------------------- */

  private merge(tracks: Track[], folder?: string, looseFiles?: string[]) {
    const map = new Map(this.state.library.map((track) => [track.id, track]));
    for (const track of tracks) {
      map.set(track.id, track);
    }

    const library = [...map.values()];
    const folders =
      folder && !this.state.folders.includes(folder)
        ? [...this.state.folders, folder]
        : this.state.folders;
    const loose =
      looseFiles && looseFiles.length
        ? [...new Set([...this.state.looseFiles, ...looseFiles])]
        : this.state.looseFiles;

    const current = this.state.current
      ? library.find((track) => track.id === this.state.current?.id) ?? null
      : null;
    const queue = this.state.queue
      .map((track) => map.get(track.id))
      .filter((track): track is Track => Boolean(track));
    const queueIndex = current ? queue.findIndex((track) => track.id === current.id) : -1;

    this.set({
      library,
      folders,
      looseFiles: loose,
      current,
      queue: queue.length ? queue : library,
      queueIndex: queueIndex >= 0 ? queueIndex : this.state.queueIndex,
    });
  }

  async addPaths(paths: string[], folder?: string, loose = false) {
    if (!paths.length) return;
    this.set({ scanning: true });
    try {
      const tracks = await backend.importPaths(paths);
      this.merge(tracks, folder, loose ? paths : undefined);
      if (!tracks.length) {
        this.setError('No supported audio or video files were found there.');
      }
    } catch (error) {
      this.setError(errorMessage(error));
    } finally {
      this.set({ scanning: false });
    }
  }

  async addFiles() {
    try {
      const tracks = await backend.pickFiles();
      if (tracks.length) {
        this.merge(tracks, undefined, tracks.map((track) => track.path));
      }
    } catch (error) {
      this.setError(errorMessage(error));
    }
  }

  async addFolder() {
    try {
      const result = await backend.pickFolder();
      if (!result) return;
      if (!result.tracks.length) {
        this.setError('No supported media was found in that folder.');
        return;
      }
      this.merge(result.tracks, result.folder);
    } catch (error) {
      this.setError(errorMessage(error));
    }
  }

  addBrowserTracks(tracks: Track[]) {
    if (!tracks.length) return;
    this.merge(tracks);
  }

  async rescan() {
    if (!backend.isTauri) {
      this.setError('Rescanning folders is only available in the desktop app.');
      return;
    }
    const targets = [...this.state.folders, ...this.state.looseFiles];
    if (!targets.length) {
      this.setError('There is nothing to rescan yet — add a folder or some files first.');
      return;
    }

    this.set({ scanning: true });
    try {
      const scanned = await backend.importPaths(targets);
      const alive = new Set(scanned.map((track) => track.id));
      const folders = this.state.folders.map((folder) => folder.toLowerCase());
      const loose = new Set(this.state.looseFiles);

      const remaining = this.state.library.filter((track) => {
        const path = track.path.toLowerCase();
        if (loose.has(track.path)) return alive.has(track.id);
        if (folders.some((folder) => path.startsWith(folder))) return alive.has(track.id);
        return true;
      });

      const map = new Map(remaining.map((track) => [track.id, track]));
      for (const track of scanned) map.set(track.id, track);
      const library = [...map.values()];

      const current = this.state.current
        ? library.find((track) => track.id === this.state.current?.id) ?? null
        : null;
      if (this.state.current && !current) {
        this.stopPlayback();
      }

      this.set({
        library,
        current,
        queue: this.state.queue
          .map((track) => map.get(track.id))
          .filter((track): track is Track => Boolean(track)),
      });
    } catch (error) {
      this.setError(errorMessage(error));
    } finally {
      this.set({ scanning: false });
    }
  }

  removeTrack(id: string) {
    backend.forgetBrowserTrack(id);
    if (this.state.current?.id === id) {
      this.stopPlayback();
      this.set({ library: this.state.library.filter((track) => track.id !== id) });
      return;
    }

    const library = this.state.library.filter((track) => track.id !== id);
    const queue = this.state.queue.filter((track) => track.id !== id);
    const queueIndex = this.state.current
      ? queue.findIndex((track) => track.id === this.state.current?.id)
      : -1;
    this.set({ library, queue, queueIndex });
  }

  /* ---------------------------- playback ---------------------------- */

  private effectiveVolume(): number {
    return this.state.muted ? 0 : this.state.volume;
  }

  private applyVolume() {
    const volume = this.effectiveVolume();
    void backend.audio.setVolume(volume).catch(() => {});
    if (this.video) this.video.volume = volume;
  }

  private stopPolling() {
    this.pollToken += 1;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async start(track: Track, autoplay: boolean) {
    const token = ++this.playToken;
    this.stopPolling();

    this.set({
      current: track,
      playing: autoplay,
      position: 0,
      duration: track.duration || 0,
      videoSrc: track.kind === 'video' ? backend.mediaUrl(track.path) : null,
    });

    await backend.audio.stop().catch(() => {});
    if (token !== this.playToken) return;

    if (track.kind === 'video') {
      // VideoSurface reacts to videoSrc/playing and drives the video element.
      return;
    }

    try {
      await backend.audio.load(track.path, track.duration || 0, autoplay);
      if (token !== this.playToken) return;
      if (autoplay) this.startPolling();
    } catch (error) {
      if (token !== this.playToken) return;
      this.set({ playing: false });
      this.setError(errorMessage(error));
    }
  }

  async playTrack(track: Track, context?: Track[]) {
    const base = context?.length ? context : this.state.library;
    const ordered =
      this.state.shuffle && base.length > 1 ? shuffleTracks(base, track.id) : base;
    const queue = ordered.some((item) => item.id === track.id) ? ordered : [track, ...ordered];
    const queueIndex = Math.max(0, queue.findIndex((item) => item.id === track.id));
    this.set({ queue, queueIndex });
    await this.start(track, true);
  }

  async playIndex(index: number) {
    const track = this.state.queue[index];
    if (!track) return;
    this.set({ queueIndex: index });
    await this.start(track, true);
  }

  async toggle() {
    const { current, playing, duration, position, library } = this.state;

    if (!current) {
      const first = library[0];
      if (first) await this.playTrack(first, library);
      return;
    }

    if (current.kind === 'video') {
      if (this.video?.ended) {
        this.video.currentTime = 0;
        this.set({ position: 0 });
      }
      this.set({ playing: !playing });
      return;
    }

    if (playing) {
      this.set({ playing: false });
      this.stopPolling();
      await backend.audio.pause().catch(() => {});
      return;
    }

    if (duration > 0 && position >= duration - 0.3) {
      await backend.audio.seek(0).catch(() => {});
      this.set({ position: 0 });
    }

    try {
      await backend.audio.play();
      this.set({ playing: true });
      this.startPolling();
    } catch (error) {
      this.setError(errorMessage(error));
    }
  }

  async next() {
    const { queue, queueIndex } = this.state;
    if (!queue.length) return;
    const nextIndex = queueIndex + 1 >= queue.length ? 0 : queueIndex + 1;
    await this.playIndex(nextIndex);
  }

  async previous() {
    const { queue, queueIndex, position } = this.state;
    if (!queue.length) return;
    if (position > 3) {
      await this.seek(0);
      return;
    }
    const previousIndex = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
    await this.playIndex(previousIndex);
  }

  async seek(position: number) {
    const { current, duration } = this.state;
    if (!current) return;
    const target = clamp(position, 0, duration || position);

    if (current.kind === 'video') {
      if (this.video) {
        this.video.currentTime = target;
      }
      this.set({ position: target });
      return;
    }

    try {
      await backend.audio.seek(target);
      this.set({ position: target });
    } catch (error) {
      this.setError(errorMessage(error));
    }
  }

  private async handleEnded() {
    this.stopPolling();
    const { repeat, current, queue, queueIndex, duration } = this.state;
    if (!current) return;

    if (repeat === 'one') {
      if (current.kind === 'video') {
        if (this.video) {
          this.video.currentTime = 0;
          try {
            await this.video.play();
          } catch {
            // Autoplay may be blocked; the user can press play.
          }
        }
        this.set({ position: 0, playing: true });
      } else {
        try {
          await backend.audio.seek(0);
          await backend.audio.play();
          this.set({ position: 0, playing: true });
          this.startPolling();
        } catch (error) {
          this.setError(errorMessage(error));
        }
      }
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat !== 'all') {
        this.set({ playing: false, position: duration });
        return;
      }
      nextIndex = 0;
    }
    await this.playIndex(nextIndex);
  }

  private startPolling() {
    this.stopPolling();
    const token = this.pollToken;

    const tick = async () => {
      if (token !== this.pollToken) return;
      const current = this.state.current;
      if (!current || current.kind !== 'audio') return;

      let status: AudioStatus;
      try {
        status = await backend.audio.status();
      } catch {
        if (token === this.pollToken) {
          this.pollTimer = setTimeout(tick, 1000);
        }
        return;
      }
      if (token !== this.pollToken) return;

      if (status.error) this.setError(status.error);

      // Ignore stale status while a new track is being prepared.
      if (status.path && status.path !== current.path) {
        this.pollTimer = setTimeout(tick, 400);
        return;
      }

      const duration = status.duration > 0 ? status.duration : this.state.duration;
      this.set({
        position: Math.min(status.position, duration || status.position),
        duration,
        playing: status.playing,
      });

      if (status.ended) {
        await this.handleEnded();
        return;
      }

      if (status.playing) {
        this.pollTimer = setTimeout(tick, 250);
      } else {
        this.stopPolling();
      }
    };

    this.pollTimer = setTimeout(tick, 250);
  }

  private stopPlayback() {
    this.playToken += 1;
    this.stopPolling();
    void backend.audio.stop().catch(() => {});
    this.video?.pause();
    this.set({
      current: null,
      playing: false,
      position: 0,
      duration: 0,
      videoSrc: null,
      queue: [],
      queueIndex: -1,
    });
  }

  /* --------------------------- video bridge --------------------------- */

  attachVideo(element: HTMLVideoElement | null) {
    this.video = element;
    if (element) {
      element.volume = this.effectiveVolume();
    }
  }

  syncVideo(position: number, duration: number) {
    if (this.state.current?.kind !== 'video') return;
    this.set({
      position,
      duration: duration > 0 && Number.isFinite(duration) ? duration : this.state.duration,
    });
  }

  async videoEnded() {
    if (this.state.current?.kind === 'video') {
      await this.handleEnded();
    }
  }

  videoError() {
    this.setError(
      'This video could not be decoded by the system webview. MP4 (H.264), WebM and OGV work best; HEVC and MPEG-4 Part 2 files are often unsupported.',
    );
  }

  /* ----------------------------- controls ----------------------------- */

  setVolume(volume: number) {
    const next = clamp(volume, 0, 1);
    this.set({ volume: next, muted: next === 0 });
    this.applyVolume();
  }

  toggleMute() {
    if (this.state.muted) {
      // Dragging the volume to zero muted us; come back to an audible level.
      this.set({
        muted: false,
        volume: this.state.volume > 0 ? this.state.volume : 0.5,
      });
    } else {
      this.set({ muted: true });
    }
    this.applyVolume();
  }

  setShuffle(enabled: boolean) {
    const { queue, queueIndex, current } = this.state;
    if (!current || queue.length < 2) {
      this.set({ shuffle: enabled });
      return;
    }
    if (enabled) {
      const played = queue.slice(0, queueIndex + 1);
      const upcoming = shuffleTracks(queue.slice(queueIndex + 1));
      this.set({ shuffle: true, queue: [...played, ...upcoming] });
    } else {
      this.set({ shuffle: false });
    }
  }

  cycleRepeat() {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const index = order.indexOf(this.state.repeat);
    this.set({ repeat: order[(index + 1) % order.length] ?? 'off' });
  }

  setView(view: ViewName, detail: string | null = null) {
    this.set({ view, detail });
  }

  setSearch(search: string) {
    this.set({ search });
  }
}

export const player = new PlayerStore();
