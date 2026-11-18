import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Icon } from './components/Icons';
import { NowPlayingView } from './components/NowPlaying';
import { PlayerBar } from './components/PlayerBar';
import { Sidebar } from './components/Sidebar';
import { VideoSurface } from './components/VideoSurface';
import {
  AlbumView,
  AlbumsView,
  ArtistView,
  ArtistsView,
  HomeView,
  QueueView,
  SearchView,
  SongsView,
  VideosView,
} from './components/Views';
import { usePlayerValue } from './hooks/usePlayerValue';
import {
  getInitialPaths,
  isNativeMedia,
  subscribeToFileDrops,
  tracksFromBrowserFiles,
} from './lib/backend';
import { player } from './lib/player';

function MainView() {
  const view = usePlayerValue((state) => state.view);
  const search = usePlayerValue((state) => state.search);

  if (search.trim()) return <SearchView />;

  switch (view) {
    case 'songs':
      return <SongsView />;
    case 'albums':
      return <AlbumsView />;
    case 'album':
      return <AlbumView />;
    case 'artists':
      return <ArtistsView />;
    case 'artist':
      return <ArtistView />;
    case 'videos':
      return <VideosView />;
    case 'queue':
      return <QueueView />;
    case 'now':
      return <NowPlayingView />;
    case 'home':
    default:
      return <HomeView />;
  }
}

export default function App() {
  const view = usePlayerValue((state) => state.view);
  const detail = usePlayerValue((state) => state.detail);
  const error = usePlayerValue((state) => state.error);
  const [dragging, setDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    // React StrictMode runs effects twice in development; scanning the CLI
    // paths twice would duplicate work and log noise.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    void (async () => {
      await player.init();
      const paths = await getInitialPaths();
      if (paths.length) {
        await player.addPaths(paths);
      }
    })();
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view, detail]);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;

    void subscribeToFileDrops(
      (paths) => void player.addPaths(paths),
      (hovering) => setDragging(hovering),
    ).then((off) => {
      if (cancelled) {
        off();
      } else {
        dispose = off;
      }
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (isNativeMedia) return;

    let depth = 0;

    const onDragEnter = (event: DragEvent) => {
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) {
        void tracksFromBrowserFiles(files).then((tracks) => player.addBrowserTracks(tracks));
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const state = player.getSnapshot();

      switch (event.key) {
        case ' ':
          event.preventDefault();
          if (!event.repeat) void player.toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey) void player.next();
          else void player.seek(state.position + 5);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey) void player.previous();
          else void player.seek(state.position - 5);
          break;
        case 'ArrowUp':
          event.preventDefault();
          player.setVolume(state.volume + 0.05);
          break;
        case 'ArrowDown':
          event.preventDefault();
          player.setVolume(state.volume - 0.05);
          break;
        case 'm':
          player.toggleMute();
          break;
        case 's':
          player.setShuffle(!state.shuffle);
          break;
        case 'r':
          player.cycleRepeat();
          break;
        case 'n':
          void player.next();
          break;
        case 'p':
          void player.previous();
          break;
        case '/':
          event.preventDefault();
          document.getElementById('search-input')?.focus();
          break;
        case 'Escape':
          if (state.search) player.setSearch('');
          else if (state.error) player.clearError();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <Sidebar />

      <main className="content" ref={contentRef}>
        <Header />
        <div className="content-inner">
          <MainView />
        </div>
      </main>

      <VideoSurface />
      <PlayerBar />

      {error ? (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button onClick={player.clearError} aria-label="Dismiss message">
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">
            <Icon name="folder-plus" size={34} />
            <h2>Drop to add to your library</h2>
            <p>Audio and video files, or a whole folder.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
