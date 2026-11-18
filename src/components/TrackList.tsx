import { useMemo, useState } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { Track } from '../lib/types';
import { formatTime, trackAlbum, trackArtist } from '../lib/utils';
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

  const select = (track: Track, index: number) => {
    if (onSelect) {
      onSelect(track, index);
    } else {
      void player.playTrack(track, sorted);
    }
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
    return <span className="sort-indicator">{sort.direction === 1 ? '↑' : '↓'}</span>;
  };

  if (!tracks.length) {
    return <div className="empty-list">{emptyMessage}</div>;
  }

  return (
    <div className="track-table">
      <div
        className={`track-head ${showArt ? '' : 'no-art'} ${showAlbum ? '' : 'no-album'} ${
          showKind ? 'with-kind' : ''
        }`}
      >
        <span className="col-index">#</span>
        {showArt ? <span className="col-art" /> : null}
        <span className="col-title">
          {sortable ? (
            <button className="sort-button" onClick={() => toggleSort('title')}>
              Title {sortIndicator('title')}
            </button>
          ) : (
            'Title'
          )}
        </span>
        {showAlbum ? (
          <span className="col-album">
            {sortable ? (
              <button className="sort-button" onClick={() => toggleSort('album')}>
                Album {sortIndicator('album')}
              </button>
            ) : (
              'Album'
            )}
          </span>
        ) : null}
        <span className="col-duration">
          {sortable ? (
            <button className="sort-button" onClick={() => toggleSort('duration')}>
              Time {sortIndicator('duration')}
            </button>
          ) : (
            'Time'
          )}
        </span>
        <span className="col-actions" />
      </div>

      <div className="track-rows" role="list" aria-label="Tracks">
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
              className={`track-row ${showArt ? '' : 'no-art'} ${showAlbum ? '' : 'no-album'} ${
                showKind ? 'with-kind' : ''
              } ${isCurrent ? 'is-current' : ''}`}
              role="listitem"
              onClick={() => select(track, index)}
              onDoubleClick={() => void player.playTrack(track, sorted)}
            >
              <button
                className="col-index row-index"
                onClick={(event) => {
                  event.stopPropagation();
                  if (isCurrent) {
                    void player.toggle();
                  } else {
                    select(track, index);
                  }
                }}
                aria-label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
              >
                {isCurrent && playing ? (
                  <Equalizer active />
                ) : (
                  <>
                    <span className="row-number">{index + 1}</span>
                    <Icon name="play" size={13} className="row-play" />
                  </>
                )}
              </button>

              {showArt ? (
                <Artwork
                  path={track.kind === 'audio' ? track.path : null}
                  seed={track.album ?? track.title}
                  size="sm"
                  lazy
                  alt={track.title}
                />
              ) : null}

              <span className="col-title row-main">
                <span className="row-title">
                  {track.title}
                  {showKind ? <span className="badge">{track.kind === 'video' ? 'VIDEO' : track.ext.toUpperCase()}</span> : null}
                </span>
                <span className="row-sub">{label}</span>
              </span>

              {showAlbum ? <span className="col-album row-album">{trackAlbum(track)}</span> : null}

              <span className="col-duration">{track.duration > 0 ? formatTime(track.duration) : '—'}</span>

              <span className="col-actions">
                {allowRemove ? (
                  <button
                    className="row-action"
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
