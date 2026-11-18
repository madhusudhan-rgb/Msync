import { useMemo, useState } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { Track } from '../lib/types';
import { formatTime, trackAlbum, trackArtist } from '../lib/utils';
import { badge } from '../lib/ui';
import { Artwork } from './Artwork';
import { Equalizer, Icon } from './Icons';

export type SortKey = 'title' | 'artist' | 'album' | 'duration' | 'track';
type Direction = 1 | -1;

interface TrackListProps {
  tracks: Track[];
  showArt?: boolean;
  showAlbum?: boolean;
  showKind?: boolean;
  sortable?: boolean;
  defaultSort?: SortKey | null;
  emptyMessage?: string;
  subtitle?: 'artist' | 'album' | 'both';
  onSelect?: (track: Track, index: number) => void;
  allowRemove?: boolean;
}

function compareTracks(a: Track, b: Track, key: SortKey): number {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'artist':
      return trackArtist(a).localeCompare(trackArtist(b));
    case 'album':
      return (
        trackAlbum(a).localeCompare(trackAlbum(b)) ||
        (a.disc ?? 1) - (b.disc ?? 1) ||
        (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title)
      );
    case 'duration':
      return (a.duration || 0) - (b.duration || 0);
    case 'track':
      return (
        (a.disc ?? 1) - (b.disc ?? 1) ||
        (a.track ?? Number.MAX_SAFE_INTEGER) - (b.track ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title)
      );
    default:
      return 0;
  }
}

function sortTracks(tracks: Track[], key: SortKey, direction: Direction): Track[] {
  return [...tracks].sort((a, b) => compareTracks(a, b, key) * direction);
}

function gridFor(showArt: boolean, showAlbum: boolean): string {
  if (showArt && showAlbum) {
    return 'grid-cols-[34px_40px_minmax(0,3fr)_minmax(0,2fr)_64px_34px] max-[720px]:grid-cols-[30px_40px_minmax(0,1fr)_52px_30px] max-[460px]:grid-cols-[26px_minmax(0,1fr)_44px]';
  }
  if (!showArt && showAlbum) {
    return 'grid-cols-[34px_minmax(0,3fr)_minmax(0,2fr)_64px_34px] max-[720px]:grid-cols-[30px_minmax(0,1fr)_52px_30px] max-[460px]:grid-cols-[26px_minmax(0,1fr)_44px]';
  }
  if (showArt && !showAlbum) {
    return 'grid-cols-[34px_40px_minmax(0,1fr)_64px_34px] max-[720px]:grid-cols-[28px_36px_minmax(0,1fr)_48px_26px] max-[460px]:grid-cols-[26px_minmax(0,1fr)_44px]';
  }
  return 'grid-cols-[34px_minmax(0,1fr)_64px_34px] max-[720px]:grid-cols-[28px_minmax(0,1fr)_48px_26px] max-[460px]:grid-cols-[26px_minmax(0,1fr)_44px]';
}

export function TrackList({
  tracks,
  showArt = true,
  showAlbum = true,
  showKind = false,
  sortable = false,
  defaultSort = 'title',
  emptyMessage = 'Nothing here yet.',
  subtitle = 'artist',
  onSelect,
  allowRemove = true,
}: TrackListProps) {
  const currentId = usePlayerValue((state) => state.current?.id ?? null);
  const playing = usePlayerValue((state) => state.playing);
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction } | null>(
    defaultSort ? { key: defaultSort, direction: 1 } : null,
  );

  const sorted = useMemo(
    () => (sort ? sortTracks(tracks, sort.key, sort.direction) : tracks),
    [tracks, sort],
  );
  const grid = gridFor(showArt, showAlbum);

  const select = (track: Track, index: number) => {
    if (onSelect) onSelect(track, index);
    else void player.playTrack(track, sorted);
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 1 ? -1 : 1 }
        : { key, direction: 1 },
    );
  };

  const sortIndicator = (key: SortKey) => {
    if (sort?.key !== key) return null;
    return <span className="ml-[2px] text-[#1ed760]">{sort.direction === 1 ? '↑' : '↓'}</span>;
  };

  if (!tracks.length) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] px-3 py-7 text-center text-[13px] text-[#a2a2ab]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`mb-[6px] grid h-[30px] items-center gap-3 border-b border-white/[0.08] px-2 text-[11px] tracking-[0.04em] text-[#6c6c75] ${grid}`}
      >
        <span className="pr-[8px] text-right">#</span>
        {showArt ? <span className="max-[460px]:hidden" /> : null}
        <span className="min-w-0 truncate">
          {sortable ? (
            <button className="p-0 hover:text-white hover:underline hover:underline-offset-[3px]" onClick={() => toggleSort('title')}>
              Title {sortIndicator('title')}
            </button>
          ) : (
            'Title'
          )}
        </span>
        {showAlbum ? (
          <span className="min-w-0 truncate max-[720px]:hidden">
            {sortable ? (
              <button className="p-0 hover:text-white hover:underline hover:underline-offset-[3px]" onClick={() => toggleSort('album')}>
                Album {sortIndicator('album')}
              </button>
            ) : (
              'Album'
            )}
          </span>
        ) : null}
        <span className="min-w-0 truncate pr-1 text-right max-[460px]:hidden">
          {sortable ? (
            <button className="p-0 hover:text-white hover:underline hover:underline-offset-[3px]" onClick={() => toggleSort('duration')}>
              Time {sortIndicator('duration')}
            </button>
          ) : (
            'Time'
          )}
        </span>
        <span className="w-[34px] max-[460px]:hidden" />
      </div>

      <div role="list" aria-label="Tracks">
        {sorted.map((track, index) => {
          const isCurrent = currentId === track.id;
          const label =
            subtitle === 'album'
              ? trackAlbum(track)
              : subtitle === 'both'
                ? `${trackArtist(track)} · ${trackAlbum(track)}`
                : trackArtist(track);

          return (
            <div
              key={track.id}
              role="listitem"
              className={`group grid min-h-[52px] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-white/[0.045] max-[720px]:px-1 ${grid}`}
              onClick={() => select(track, index)}
              onDoubleClick={() => void player.playTrack(track, sorted)}
            >
              <button
                className="relative grid h-7 place-items-center text-right text-[12px] tabular-nums text-[#6c6c75] transition-colors hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  if (isCurrent) void player.toggle();
                  else select(track, index);
                }}
                aria-label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
              >
                {isCurrent && playing ? (
                  <Equalizer active />
                ) : (
                  <>
                    <span className="transition-opacity group-hover:opacity-0">{index + 1}</span>
                    <Icon
                      name="play"
                      size={13}
                      className="absolute opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </>
                )}
              </button>

              {showArt ? (
                <span className="max-[460px]:hidden">
                  <Artwork
                    path={track.kind === 'audio' ? track.path : null}
                    seed={track.album ?? track.title}
                    size="sm"
                    lazy
                    alt={track.title}
                  />
                </span>
              ) : null}

              <span className="flex min-w-0 flex-col gap-px">
                <span
                  className={`flex min-w-0 items-center gap-2 truncate text-[13.5px] font-medium ${
                    isCurrent ? 'text-[#1ed760]' : 'text-white'
                  }`}
                >
                  {track.title}
                  {showKind ? (
                    <span className={badge}>
                      {track.kind === 'video' ? 'VIDEO' : track.ext.toUpperCase()}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[11.5px] text-[#a2a2ab]">{label}</span>
              </span>

              {showAlbum ? (
                <span className="min-w-0 truncate text-[12px] text-[#a2a2ab] max-[720px]:hidden">
                  {trackAlbum(track)}
                </span>
              ) : null}

              <span className="min-w-0 truncate text-right text-[12px] tabular-nums text-[#a2a2ab] max-[460px]:hidden">
                {track.duration > 0 ? formatTime(track.duration) : '—'}
              </span>

              <span className="grid place-items-center max-[460px]:hidden">
                {allowRemove ? (
                  <button
                    className="grid h-[26px] w-[26px] place-items-center rounded-full text-[#6c6c75] opacity-0 transition hover:bg-[#ff6b6b]/10 hover:text-[#ff6b6b] focus-visible:opacity-100 group-hover:opacity-100 max-[680px]:opacity-60"
                    title="Remove from library"
                    aria-label={`Remove ${track.title} from library`}
                    onClick={(event) => {
                      event.stopPropagation();
                      player.removeTrack(track.id);
                    }}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
