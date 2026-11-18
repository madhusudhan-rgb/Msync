import { useEffect, useRef } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { Icon } from './Icons';

/**
 * A single <video> element that is always mounted. It grows into an immersive
 * stage in the "Now playing" view and shrinks into the player bar artwork slot
 * while the user browses. Keeping one element means audio never restarts when
 * the layout changes.
 */
export function VideoSurface() {
  const videoSrc = usePlayerValue((state) => state.videoSrc);
  const playing = usePlayerValue((state) => state.playing);
  const view = usePlayerValue((state) => state.view);
  const current = usePlayerValue((state) => state.current);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    player.attachVideo(ref.current);
    return () => player.attachVideo(null);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!videoSrc) {
      element.pause();
      element.removeAttribute('src');
      element.load();
      return;
    }

    element.load();
    if (player.getSnapshot().playing) {
      void element.play().catch(() => {});
    }
  }, [videoSrc]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !videoSrc) return;
    if (playing) {
      void element.play().catch(() => {});
    } else {
      element.pause();
    }
  }, [playing, videoSrc]);

  const isStage = view === 'now';

  return (
    <>
      <video
        ref={ref}
        className={`video-surface ${
          videoSrc ? (isStage ? 'is-stage' : 'is-mini') : 'is-hidden'
        }`}
        src={videoSrc ?? undefined}
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
        onError={() => {
          if (videoSrc) player.videoError();
        }}
      />

      {isStage && videoSrc ? (
        <button
          className="video-collapse"
          onClick={() => player.setView('songs')}
          title="Back to browsing"
        >
          <Icon name="chevron-left" size={16} />
          <span>Browse</span>
        </button>
      ) : null}

      {!isStage && videoSrc && current ? (
        <span className="video-mini-label" aria-hidden="true">
          <Icon name="film" size={10} />
        </span>
      ) : null}
    </>
  );
}
