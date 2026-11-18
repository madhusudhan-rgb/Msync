import { useState, type CSSProperties } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { formatTime, trackArtist, trackAlbum } from '../lib/utils';
import {
  badge,
  iconButton,
  playButton,
  rangeInput,
  rangeThumb,
  rangeThumbHover,
  rangeTrack,
  timeLabel,
} from '../lib/ui';
import { Artwork } from './Artwork';
import { Icon } from './Icons';

interface SeekBarProps {
  position: number;
  duration: number;
  onSeek: (value: number) => void;
  disabled?: boolean;
}

function SeekBar({ position, duration, onSeek, disabled }: SeekBarProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const max = duration > 0 ? duration : 1;
  const value = preview ?? position;
  const percent = Math.max(0, Math.min(100, (Math.min(value, max) / max) * 100));

  const commit = (next: number) => {
    setPreview(null);
    onSeek(next);
  };

  return (
    <input
      className={`${rangeInput} ${rangeTrack} ${rangeThumb} ${rangeThumbHover} min-w-0 flex-1`}
      type="range"
      min={0}
      max={max}
      step={0.1}
      value={Number.isFinite(value) ? Math.min(value, max) : 0}
      style={{ '--fill': `${percent}%` } as CSSProperties}
      disabled={disabled || duration <= 0}
      onChange={(event) => setPreview(Number(event.target.value))}
      onPointerUp={(event) => commit(Number(event.currentTarget.value))}
      onKeyUp={(event) => {
        if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
          commit(Number(event.currentTarget.value));
        }
      }}
      onBlur={() => {
        if (preview !== null) commit(preview);
      }}
      aria-label="Seek"
    />
  );
}

export function PlayerBar() {
  const current = usePlayerValue((state) => state.current);
  const playing = usePlayerValue((state) => state.playing);
  const position = usePlayerValue((state) => state.position);
  const duration = usePlayerValue((state) => state.duration);
  const volume = usePlayerValue((state) => state.volume);
  const muted = usePlayerValue((state) => state.muted);
  const shuffle = usePlayerValue((state) => state.shuffle);
  const repeat = usePlayerValue((state) => state.repeat);
  const hasTracks = usePlayerValue((state) => state.library.length > 0);

  const volumeIcon = muted || volume === 0 ? 'mute' : volume < 0.5 ? 'volume-low' : 'volume';

  return (
    <footer className="col-span-full row-start-2 z-40 grid h-[84px] grid-cols-[minmax(180px,1fr)_minmax(320px,2fr)_minmax(160px,1fr)] items-center gap-4 border-t border-white/[0.08] bg-[#0c0c0e] px-5 py-[10px] backdrop-blur-xl max-[900px]:grid-cols-[minmax(150px,1fr)_minmax(300px,2fr)_auto] max-[900px]:gap-[10px] max-[900px]:px-[14px] max-[680px]:h-[132px] max-[680px]:grid-cols-[minmax(0,1fr)_auto] max-[680px]:grid-rows-[auto_auto] max-[680px]:gap-x-[10px] max-[680px]:gap-y-[2px] max-[680px]:px-[14px] max-[680px]:py-2">
      <div className="flex min-w-0 items-center gap-3 max-[680px]:col-start-1 max-[680px]:row-start-1">
        <button
          className="shrink-0 rounded-lg"
          onClick={() => player.setView('now')}
          title="Open now playing"
          aria-label="Open now playing"
        >
          <Artwork
            path={current?.path ?? null}
            seed={current?.album ?? current?.title ?? 'Musicplayer'}
            size="md"
            alt={current?.title ?? 'Nothing playing'}
          />
        </button>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold">
              {current?.title ?? 'Nothing playing'}
            </span>
            {current?.kind === 'video' ? <span className={badge}>VIDEO</span> : null}
          </div>
          <span className="truncate text-[11.5px] text-[#a2a2ab]">
            {current ? `${trackArtist(current)} · ${trackAlbum(current)}` : 'Add music to begin'}
          </span>
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col items-center gap-1 max-[680px]:col-span-full max-[680px]:row-start-2">
        <div className="flex items-center justify-center gap-[6px]">
          <button
            className={`${iconButton} ${shuffle ? 'text-[#1ed760]' : ''}`}
            onClick={() => player.setShuffle(!shuffle)}
            title="Shuffle"
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <Icon name="shuffle" size={17} />
          </button>

          <button
            className={iconButton}
            onClick={() => void player.previous()}
            title="Previous"
            aria-label="Previous"
            disabled={!current}
          >
            <Icon name="previous" size={19} />
          </button>

          <button
            className={playButton}
            onClick={() => void player.toggle()}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!current && !hasTracks}
          >
            <Icon name={playing ? 'pause' : 'play'} size={21} />
          </button>

          <button
            className={iconButton}
            onClick={() => void player.next()}
            title="Next"
            aria-label="Next"
            disabled={!current}
          >
            <Icon name="next" size={19} />
          </button>

          <button
            className={`${iconButton} ${repeat !== 'off' ? 'text-[#1ed760]' : ''}`}
            onClick={() => player.cycleRepeat()}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            aria-label="Repeat"
            aria-pressed={repeat !== 'off'}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} size={17} />
          </button>
        </div>

        <div className="flex w-full max-w-[640px] items-center gap-[10px]">
          <span className={timeLabel}>{formatTime(position)}</span>
          <SeekBar position={position} duration={duration} onSeek={(value) => void player.seek(value)} />
          <span className={timeLabel}>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 max-[680px]:col-start-2 max-[680px]:row-start-1">
        <button
          className={iconButton}
          onClick={() => player.toggleMute()}
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <Icon name={volumeIcon} size={18} />
        </button>
        <input
          className={`${rangeInput} ${rangeTrack} ${rangeThumb} ${rangeThumbHover} w-[92px] shrink-0 max-[1100px]:w-[70px] max-[900px]:hidden`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          style={{ '--fill': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
          onChange={(event) => player.setVolume(Number(event.target.value))}
          aria-label="Volume"
        />
        <button
          className={iconButton}
          onClick={() => player.setView('queue')}
          title="Queue"
          aria-label="Queue"
        >
          <Icon name="queue" size={18} />
        </button>
        <button
          className={iconButton}
          onClick={() => player.setView('now')}
          title="Now playing"
          aria-label="Now playing"
        >
          <Icon name="chevron-left" size={18} className="scale-x-[-1]" />
        </button>
      </div>
    </footer>
  );
}
