import { useEffect, useRef, useState } from 'react';
import * as backend from '../lib/backend';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { Icon } from './Icons';

const stage =
  'col-start-2 row-start-1 z-30 h-full w-full min-h-0 min-w-0 bg-black object-contain max-[680px]:col-start-1';
const mini =
  'fixed bottom-[16px] left-5 z-[60] h-[52px] w-[52px] cursor-pointer rounded-lg object-cover shadow-[0_4px_14px_rgba(0,0,0,0.5)] max-[680px]:bottom-[130px] max-[680px]:left-[14px]';

interface SurfaceProps {
  src: string | null;
  path: string | null;
  playing: boolean;
  isStage: boolean;
}

function Surface({ src, path, playing, isStage }: SurfaceProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    player.attachVideo(ref.current);
    return () => player.attachVideo(null);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!src) {
      element.pause();
      element.removeAttribute('src');
      element.load();
      return;
    }

    element.load();
    if (player.getSnapshot().playing) void element.play().catch(() => {});
  }, [src]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !src) return;
    if (playing) void element.play().catch(() => {});
    else element.pause();
  }, [playing, src]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !fallback) return;
    element.load();
    if (player.getSnapshot().playing) void element.play().catch(() => {});
  }, [fallback]);

  const onError = () => {
    if (!src || !path) return;

    // Some webviews cannot open local files through the asset protocol. Try
    // feeding the same bytes as a data URL before declaring the codec invalid.
    if (!triedFallback && backend.isNativeMedia) {
      setTriedFallback(true);
      void backend
        .mediaDataUrl(path)
        .then((data) => setFallback(data))
        .catch(() => player.videoError());
      return;
    }
    player.videoError();
  };

  return (
    <video
      ref={ref}
      className={!src ? 'hidden' : isStage ? stage : mini}
      src={fallback ?? src ?? undefined}
      preload="metadata"
      playsInline
      onClick={() => {
        if (!isStage) player.setView('now');
      }}
      onLoadedMetadata={(event) => {
        const element = event.currentTarget;
        player.syncVideo(element.currentTime, element.duration);
      }}
      onTimeUpdate={(event) => {
        const element = event.currentTarget;
        player.syncVideo(element.currentTime, element.duration);
      }}
      onEnded={() => void player.videoEnded()}
      onError={onError}
    />
  );
}

/** One always-mounted video slot; switching views never stops playback. */
export function VideoSurface() {
  const videoSrc = usePlayerValue((state) => state.videoSrc);
  const playing = usePlayerValue((state) => state.playing);
  const view = usePlayerValue((state) => state.view);
  const current = usePlayerValue((state) => state.current);
  const isStage = view === 'now';

  return (
    <>
      <Surface
        key={videoSrc ?? 'none'}
        src={videoSrc}
        path={current?.path ?? null}
        playing={playing}
        isStage={isStage}
      />

      {isStage && videoSrc ? (
        <button
          className="fixed right-[18px] top-[14px] z-[32] inline-flex h-8 items-center gap-1 rounded-full border border-white/20 bg-black/60 px-[14px] text-[12px] font-semibold text-white backdrop-blur transition hover:bg-black/85"
          onClick={() => player.setView('songs')}
          title="Back to browsing"
        >
          <Icon name="chevron-left" size={16} />
          Browse
        </button>
      ) : null}

      {!isStage && videoSrc && current ? (
        <span
          className="pointer-events-none fixed bottom-[18px] left-[60px] z-[61] grid h-4 w-4 place-items-center rounded-full bg-[#1ed760] text-[#04140a] max-[680px]:bottom-[132px] max-[680px]:left-[50px]"
          aria-hidden="true"
        >
          <Icon name="film" size={10} />
        </span>
      ) : null}
    </>
  );
}
