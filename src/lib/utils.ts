import type { Track } from './types';

export const UNKNOWN_ALBUM = 'Unknown album';
export const UNKNOWN_ARTIST = 'Unknown artist';

export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatTotalDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function trackArtist(track: Track): string {
  return track.artist?.trim() || UNKNOWN_ARTIST;
}

export function trackAlbum(track: Track): string {
  return track.album?.trim() || UNKNOWN_ALBUM;
}

/** Deterministic hue so placeholder artwork is stable between renders. */
export function hashHue(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

export function shuffleTracks(tracks: Track[], keepFirstId?: string): Track[] {
  const result = [...tracks];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const a = result[index];
    const b = result[swap];
    if (a && b) {
      result[index] = b;
      result[swap] = a;
    }
  }

  if (keepFirstId) {
    const index = result.findIndex((track) => track.id === keepFirstId);
    if (index > 0) {
      const [kept] = result.splice(index, 1);
      if (kept) {
        result.unshift(kept);
      }
    }
  }
  return result;
}

export interface AlbumGroup {
  /** Stable key: album name plus artist, so same-named albums stay separate. */
  key: string;
  name: string;
  artist: string;
  tracks: Track[];
  duration: number;
}

const ALBUM_KEY_SEPARATOR = '\u001f';

export function albumKey(track: Track): string {
  return `${trackAlbum(track)}${ALBUM_KEY_SEPARATOR}${trackArtist(track)}`;
}

export function splitAlbumKey(key: string): { album: string; artist: string | null } {
  const index = key.indexOf(ALBUM_KEY_SEPARATOR);
  if (index < 0) return { album: key, artist: null };
  return { album: key.slice(0, index), artist: key.slice(index + 1) };
}

export function groupAlbums(tracks: Track[]): AlbumGroup[] {
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    if (track.kind !== 'audio') continue;
    const name = albumKey(track);
    const existing = groups.get(name);
    if (existing) {
      existing.push(track);
    } else {
      groups.set(name, [track]);
    }
  }

  return [...groups.entries()]
    .map(([key, albumTracks]) => {
      const sorted = sortAlbumTracks(albumTracks);
      const first = sorted[0];
      return {
        key,
        name: splitAlbumKey(key).album,
        artist: first ? trackArtist(first) : UNKNOWN_ARTIST,
        tracks: sorted,
        duration: sorted.reduce((sum, track) => sum + (track.duration || 0), 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.artist.localeCompare(b.artist));
}

export interface ArtistGroup {
  name: string;
  tracks: Track[];
}

export function groupArtists(tracks: Track[]): ArtistGroup[] {
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    if (track.kind !== 'audio') continue;
    const name = trackArtist(track);
    const existing = groups.get(name);
    if (existing) {
      existing.push(track);
    } else {
      groups.set(name, [track]);
    }
  }
  return [...groups.entries()]
    .map(([name, artistTracks]) => ({ name, tracks: artistTracks }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Album order: disc then track number, then title. */
export function sortAlbumTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const discA = a.disc ?? 1;
    const discB = b.disc ?? 1;
    if (discA !== discB) return discA - discB;
    const trackA = a.track ?? Number.MAX_SAFE_INTEGER;
    const trackB = b.track ?? Number.MAX_SAFE_INTEGER;
    if (trackA !== trackB) return trackA - trackB;
    return a.title.localeCompare(b.title);
  });
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function trackMatches(track: Track, query: string): boolean {
  if (!query) return true;
  return (
    track.title.toLowerCase().includes(query) ||
    (track.artist ?? '').toLowerCase().includes(query) ||
    (track.album ?? '').toLowerCase().includes(query)
  );
}
