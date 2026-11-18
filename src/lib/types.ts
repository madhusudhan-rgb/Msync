export type MediaKind = 'audio' | 'video';

export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  /** Seconds. May be 0 until a video's metadata is read. */
  duration: number;
  kind: MediaKind;
  ext: string;
  size: number;
  modified: number;
  track: number | null;
  disc: number | null;
}

export interface AudioStatus {
  path: string | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  ended: boolean;
  error: string | null;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type ViewName =
  | 'home'
  | 'songs'
  | 'albums'
  | 'artists'
  | 'videos'
  | 'queue'
  | 'now'
  | 'album'
  | 'artist'
  | 'settings';

export interface PlayerState {
  library: Track[];
  folders: string[];
  /** Paths that were added as individual files and cannot be rescanned. */
  looseFiles: string[];
  view: ViewName;
  detail: string | null;
  queue: Track[];
  queueIndex: number;
  current: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  videoSrc: string | null;
  search: string;
  scanning: boolean;
  error: string | null;
}
