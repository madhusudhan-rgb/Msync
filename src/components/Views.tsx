import { useMemo } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import {
  UNKNOWN_ALBUM,
  formatTotalDuration,
  groupAlbums,
  groupArtists,
  normalizeSearch,
  sortAlbumTracks,
  splitAlbumKey,
  trackAlbum,
  trackArtist,
  trackMatches,
} from '../lib/utils';
import {
  backButton,
  cardArt,
  cardGrid,
  cardName,
  cardSub,
  detailHero,
  detailSub,
  detailTitle,
  emptyActions,
  emptyIcon,
  emptyState,
  emptyText,
  emptyTitle,
  eyebrow,
  linkButton,
  mediaCard,
  primaryButton,
  queueCurrent,
  secondaryButton,
  section,
  sectionHead,
  sectionMeta,
  sectionTitle,
} from '../lib/ui';
import { Artwork } from './Artwork';
import { Icon } from './Icons';
import { TrackList } from './TrackList';

export function EmptyLibrary() {
  return (
    <div className={emptyState}>
      <span className={emptyIcon}>
        <Icon name="music" size={30} />
      </span>
      <h2 className={emptyTitle}>Your library is empty</h2>
      <p className={emptyText}>
        Point the player at a folder of music, or add a few files. Nothing is copied or uploaded.
      </p>
      <div className={emptyActions}>
        <button className={primaryButton} onClick={() => void player.addFolder()}>
          <Icon name="folder-plus" size={17} /> Add music folder
        </button>
        <button className={secondaryButton} onClick={() => void player.addFiles()}>
          <Icon name="file-plus" size={17} /> Add files
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-[#6c6c75]">
        You can also drag files or folders straight into this window.
      </p>
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={section}>
      {title || meta ? (
        <div className={sectionHead}>
          {title ? <h2 className={sectionTitle}>{title}</h2> : null}
          {meta ? <span className={sectionMeta}>{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function AlbumGrid({ albums }: { albums: ReturnType<typeof groupAlbums> }) {
  return (
    <div className={cardGrid}>
      {albums.map((album) => {
        const first = album.tracks[0];
        return (
          <button
            key={album.key}
            className={mediaCard}
            onClick={() => player.setView('album', album.key)}
            title={`Open ${album.name}`}
          >
            <Artwork
              path={first?.path}
              seed={album.name}
              size="md"
              lazy
              className={cardArt}
              alt={album.name}
            />
            <span className={cardName}>{album.name}</span>
            <span className={cardSub}>
              {album.artist} · {album.tracks.length} {album.tracks.length === 1 ? 'song' : 'songs'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ArtistGrid({ artists }: { artists: ReturnType<typeof groupArtists> }) {
  return (
    <div className={cardGrid}>
      {artists.map((artist) => (
        <button
          key={artist.name}
          className={mediaCard}
          onClick={() => player.setView('artist', artist.name)}
          title={`Open ${artist.name}`}
        >
          <Artwork
            path={artist.tracks[0]?.path}
            seed={artist.name}
            size="md"
            shape="round"
            lazy
            className={cardArt}
            alt={artist.name}
          />
          <span className={cardName}>{artist.name}</span>
          <span className={cardSub}>
            {artist.tracks.length} {artist.tracks.length === 1 ? 'song' : 'songs'}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SearchView() {
  const library = usePlayerValue((state) => state.library);
  const search = usePlayerValue((state) => state.search);
  const query = normalizeSearch(search);
  const results = useMemo(
    () => library.filter((track) => trackMatches(track, query)),
    [library, query],
  );

  return (
    <Section
      title={`Results for “${search.trim()}”`}
      meta={`${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
    >
      <TrackList
        tracks={results}
        showKind
        showAlbum
        showArt
        sortable
        emptyMessage="Nothing matched that search."
      />
    </Section>
  );
}

export function HomeView() {
  const library = usePlayerValue((state) => state.library);
  const audio = useMemo(() => library.filter((track) => track.kind === 'audio'), [library]);
  const albums = useMemo(() => groupAlbums(audio), [audio]);
  const knownAlbums = useMemo(
    () => albums.filter((album) => album.name !== UNKNOWN_ALBUM).length,
    [albums],
  );
  const recent = useMemo(
    () => [...library].sort((a, b) => b.modified - a.modified).slice(0, 8),
    [library],
  );
  const totalDuration = useMemo(
    () => audio.reduce((sum, track) => sum + (track.duration || 0), 0),
    [audio],
  );

  if (!library.length) return <EmptyLibrary />;

  return (
    <>
      <div className="flex flex-wrap items-center gap-[14px] pb-5 pt-[6px]">
        <button
          className={primaryButton}
          onClick={() => {
            const first = audio[0] ?? library[0];
            if (first) void player.playTrack(first, library);
          }}
        >
          <Icon name="play" size={16} /> Play all
        </button>
        <span className="text-[12.5px] text-[#a2a2ab]">
          {[
            `${audio.length} ${audio.length === 1 ? 'song' : 'songs'}`,
            knownAlbums ? `${knownAlbums} ${knownAlbums === 1 ? 'album' : 'albums'}` : null,
            formatTotalDuration(totalDuration),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      <Section title="Recently added">
        <TrackList tracks={recent} showAlbum showArt />
      </Section>

      {albums.length ? (
        <Section title="Albums">
          <AlbumGrid albums={albums.slice(0, 8)} />
        </Section>
      ) : null}
    </>
  );
}

export function SongsView() {
  const library = usePlayerValue((state) => state.library);
  const tracks = useMemo(() => library.filter((track) => track.kind === 'audio'), [library]);
  const duration = useMemo(
    () => tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
    [tracks],
  );

  if (!library.some((track) => track.kind === 'audio')) return <EmptyLibrary />;

  return (
    <Section
      meta={`${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'} · ${formatTotalDuration(duration)}`}
    >
      <TrackList tracks={tracks} showAlbum sortable emptyMessage="No songs yet." />
    </Section>
  );
}

export function AlbumsView() {
  const library = usePlayerValue((state) => state.library);
  const albums = useMemo(
    () => groupAlbums(library.filter((track) => track.kind === 'audio')),
    [library],
  );

  if (!library.some((track) => track.kind === 'audio')) return <EmptyLibrary />;

  return (
    <Section meta={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}>
      <AlbumGrid albums={albums} />
    </Section>
  );
}

export function AlbumView() {
  const library = usePlayerValue((state) => state.library);
  const detail = usePlayerValue((state) => state.detail);
  const { album, artist } = detail ? splitAlbumKey(detail) : { album: '', artist: null };
  const tracks = useMemo(
    () =>
      detail
        ? sortAlbumTracks(
            library.filter(
              (track) =>
                track.kind === 'audio' &&
                trackAlbum(track) === album &&
                (artist === null || trackArtist(track) === artist),
            ),
          )
        : [],
    [library, detail, album, artist],
  );

  if (!detail || !tracks.length) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] p-4 text-center text-[13px] text-[#a2a2ab]">
        That album is no longer in your library.{' '}
        <button className={linkButton} onClick={() => player.setView('albums')}>
          Back to albums
        </button>
      </div>
    );
  }

  const first = tracks[0];
  const duration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <>
      <button className={backButton} onClick={() => player.setView('albums')}>
        <Icon name="chevron-left" size={16} /> Albums
      </button>

      <section className={detailHero}>
        <Artwork
          path={first?.path}
          seed={album}
          size="lg"
          className="shrink-0 shadow-[0_24px_50px_rgba(0,0,0,0.4)]"
          alt={album}
        />
        <div className="min-w-0 pb-1">
          <p className={eyebrow}>Album</p>
          <h2 className={detailTitle}>{album}</h2>
          <p className={detailSub}>
            {first ? trackArtist(first) : ''} · {tracks.length}{' '}
            {tracks.length === 1 ? 'song' : 'songs'} · {formatTotalDuration(duration)}
          </p>
          <div className="mt-[18px] flex gap-2">
            <button
              className={primaryButton}
              onClick={() => {
                if (first) void player.playTrack(first, tracks);
              }}
            >
              <Icon name="play" size={16} /> Play album
            </button>
          </div>
        </div>
      </section>

      <TrackList
        tracks={tracks}
        showArt={false}
        showAlbum={false}
        sortable
        defaultSort="track"
        subtitle="artist"
      />
    </>
  );
}

export function ArtistsView() {
  const library = usePlayerValue((state) => state.library);
  const artists = useMemo(
    () => groupArtists(library.filter((track) => track.kind === 'audio')),
    [library],
  );

  if (!library.some((track) => track.kind === 'audio')) return <EmptyLibrary />;

  return (
    <Section meta={`${artists.length} ${artists.length === 1 ? 'artist' : 'artists'}`}>
      <ArtistGrid artists={artists} />
    </Section>
  );
}

export function ArtistView() {
  const library = usePlayerValue((state) => state.library);
  const detail = usePlayerValue((state) => state.detail);
  const tracks = useMemo(
    () =>
      detail
        ? library
            .filter((track) => track.kind === 'audio' && trackArtist(track) === detail)
            .sort((a, b) => {
              const album = trackAlbum(a).localeCompare(trackAlbum(b));
              if (album !== 0) return album;
              return (a.track ?? 0) - (b.track ?? 0);
            })
        : [],
    [library, detail],
  );

  if (!detail || !tracks.length) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] p-4 text-center text-[13px] text-[#a2a2ab]">
        That artist is no longer in your library.{' '}
        <button className={linkButton} onClick={() => player.setView('artists')}>
          Back to artists
        </button>
      </div>
    );
  }

  const first = tracks[0];

  return (
    <>
      <button className={backButton} onClick={() => player.setView('artists')}>
        <Icon name="chevron-left" size={16} /> Artists
      </button>

      <section className={detailHero}>
        <Artwork
          path={first?.path}
          seed={detail}
          size="lg"
          shape="round"
          className="shrink-0 shadow-[0_24px_50px_rgba(0,0,0,0.4)]"
          alt={detail}
        />
        <div className="min-w-0 pb-1">
          <p className={eyebrow}>Artist</p>
          <h2 className={detailTitle}>{detail}</h2>
          <p className={detailSub}>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</p>
          <div className="mt-[18px] flex gap-2">
            <button
              className={primaryButton}
              onClick={() => {
                if (first) void player.playTrack(first, tracks);
              }}
            >
              <Icon name="play" size={16} /> Play artist
            </button>
          </div>
        </div>
      </section>

      <TrackList
        tracks={tracks}
        showArt={false}
        showAlbum
        sortable
        defaultSort="album"
        subtitle="album"
      />
    </>
  );
}

export function VideosView() {
  const library = usePlayerValue((state) => state.library);
  const tracks = useMemo(() => library.filter((track) => track.kind === 'video'), [library]);

  if (!library.some((track) => track.kind === 'video')) {
    return (
      <div className={emptyState}>
        <span className={emptyIcon}>
          <Icon name="film" size={30} />
        </span>
        <h2 className={emptyTitle}>No videos yet</h2>
        <p className={emptyText}>
          Add MP4, WebM, or other video files. Video uses the system webview, so format support
          depends on your platform codecs.
        </p>
        <div className={emptyActions}>
          <button className={primaryButton} onClick={() => void player.addFiles()}>
            <Icon name="file-plus" size={17} /> Add videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <Section meta={`${tracks.length} ${tracks.length === 1 ? 'clip' : 'clips'}`}>
      <TrackList
        tracks={tracks}
        showArt={false}
        showAlbum={false}
        showKind
        sortable
        emptyMessage="No videos yet."
      />
    </Section>
  );
}

export function QueueView() {
  const queue = usePlayerValue((state) => state.queue);
  const queueIndex = usePlayerValue((state) => state.queueIndex);
  const current = usePlayerValue((state) => state.current);

  if (!queue.length) {
    return (
      <div className={`${emptyState} my-7 p-7`}>
        <span className={emptyIcon}>
          <Icon name="queue" size={28} />
        </span>
        <h2 className={emptyTitle}>The queue is empty</h2>
        <p className={emptyText}>Play something from your library and it will show up here.</p>
        <div className={emptyActions}>
          <button className={secondaryButton} onClick={() => player.setView('songs')}>
            Browse songs
          </button>
        </div>
      </div>
    );
  }

  const upNext = queue.slice(queueIndex + 1);
  const upNextOffset = queueIndex + 1;

  return (
    <>
      <Section title="Now playing" meta={current ? undefined : 'Nothing playing'}>
        {current ? (
          <div className={queueCurrent}>
            <Artwork
              path={current.kind === 'audio' ? current.path : null}
              seed={current.album ?? current.title}
              size="md"
              alt={current.title}
            />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{current.title}</div>
              <div className="truncate text-[12px] text-[#a2a2ab]">
                {trackArtist(current)} · {trackAlbum(current)}
              </div>
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        title="Up next"
        meta={`${upNext.length} ${upNext.length === 1 ? 'track' : 'tracks'}`}
      >
        <TrackList
          tracks={upNext}
          showAlbum
          defaultSort={null}
          sortable={false}
          allowRemove={false}
          emptyMessage="Nothing queued after this track."
          onSelect={(_track, index) => void player.playIndex(upNextOffset + index)}
        />
      </Section>
    </>
  );
}
