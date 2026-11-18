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
    <div className="grid h-full grid-cols-[232px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_84px] bg-[#0a0a0b] font-['Inter_Variable',system-ui,sans-serif] text-[#f5f5f7] max-[900px]:grid-cols-[76px_minmax(0,1fr)] max-[680px]:grid-cols-[minmax(0,1fr)] max-[680px]:grid-rows-[minmax(0,1fr)_132px_58px]">
      <Sidebar />

      <main
        className="relative col-start-2 row-start-1 min-w-0 overflow-x-hidden overflow-y-auto bg-[#0a0a0b] [&::-webkit-scrollbar]:h-[10px] [&::-webkit-scrollbar]:w-[10px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-white/[0.14] [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-track]:bg-transparent max-[680px]:col-start-1"
        ref={contentRef}
      >
        <Header />
        <div className="mx-auto max-w-[1240px] px-8 pb-12 pt-[18px] max-[1100px]:px-6 max-[720px]:px-4 max-[720px]:pb-10 max-[680px]:pt-1">
          <MainView />
        </div>
      </main>

      <VideoSurface />
      <PlayerBar />

      {error ? (
        <div className="fixed bottom-[calc(84px+16px)] right-5 z-[80] flex max-w-[440px] items-start gap-[14px] rounded-[10px] border border-[#ff6b6b]/35 border-l-[3px] border-l-[#ff6b6b] bg-[#1b1416] px-4 py-3 text-[12.5px] leading-relaxed text-[#ffd9d9] shadow-[0_18px_40px_rgba(0,0,0,0.45)] max-[680px]:bottom-[calc(132px+58px+12px)] max-[680px]:left-3 max-[680px]:right-3 max-[680px]:max-w-none" role="alert">
          <span>{error}</span>
          <button
            className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[#ffb3b3] hover:bg-[#ff6b6b]/15 hover:text-white"
            onClick={player.clearError}
            aria-label="Dismiss message"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-[#050806]/75 p-7 backdrop-blur-lg" aria-hidden="true">
          <div className="flex w-full max-w-[560px] flex-col items-center gap-2 rounded-[20px] border-2 border-dashed border-white/25 bg-[#0f180f]/70 px-10 py-12 text-center text-[#1ed760]">
            <Icon name="folder-plus" size={34} />
            <h2 className="text-[21px] font-bold text-white">Drop to add to your library</h2>
            <p className="text-[13px] text-[#a2a2ab]">Audio and video files, or a whole folder.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
