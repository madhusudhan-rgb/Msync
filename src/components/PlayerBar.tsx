import { useState, type CSSProperties } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { formatTime, trackArtist, trackAlbum } from '../lib/utils';
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
      className="seek-bar"
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
    <footer className="player-bar">
      <div className="player-left">
        <button
          className="player-art"
          onClick={() => player.setView('now')}
          title="Open now playing"
          aria-label="Open now playing"
        >
          <Artwork
            path={current?.kind === 'audio' ? current.path : null}
            seed={current?.album ?? current?.title ?? 'Musicplayer'}
            size="md"
            alt={current?.title ?? 'Nothing playing'}
          />
        </button>
        <div className="player-meta">
          <div className="player-title-row">
            <span className="player-title">{current?.title ?? 'Nothing playing'}</span>
            {current?.kind === 'video' ? <span className="badge">VIDEO</span> : null}
          </div>
          <span className="player-sub">
            {current ? `${trackArtist(current)} · ${trackAlbum(current)}` : 'Add music to begin'}
          </span>
        </div>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className={`icon-button ${shuffle ? 'is-active' : ''}`}
            onClick={() => player.setShuffle(!shuffle)}
            title="Shuffle"
            aria-label="Shuffle"
            aria-pressed={shuffle}
          >
            <Icon name="shuffle" size={17} />
          </button>

          <button
            className="icon-button"
            onClick={() => void player.previous()}
            title="Previous"
            aria-label="Previous"
            disabled={!current}
          >
            <Icon name="previous" size={19} />
          </button>

          <button
            className="play-button"
            onClick={() => void player.toggle()}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!current && !hasTracks}
          >
            <Icon name={playing ? 'pause' : 'play'} size={21} />
          </button>

          <button
            className="icon-button"
            onClick={() => void player.next()}
            title="Next"
            aria-label="Next"
            disabled={!current}
          >
            <Icon name="next" size={19} />
          </button>

          <button
            className={`icon-button ${repeat !== 'off' ? 'is-active' : ''}`}
            onClick={() => player.cycleRepeat()}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            aria-label="Repeat"
            aria-pressed={repeat !== 'off'}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} size={17} />
          </button>
        </div>

        <div className="progress-row">
          <span className="time">{formatTime(position)}</span>
          <SeekBar position={position} duration={duration} onSeek={(value) => void player.seek(value)} />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button
          className="icon-button"
          onClick={() => player.toggleMute()}
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <Icon name={volumeIcon} size={18} />
        </button>
        <input
          className="volume-bar"
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
          className="icon-button queue-button"
          onClick={() => player.setView('queue')}
          title="Queue"
          aria-label="Queue"
        >
          <Icon name="queue" size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => player.setView('now')}
          title="Now playing"
          aria-label="Now playing"
        >
          <Icon name="chevron-left" size={18} className="flip-horizontal" />
        </button>
      </div>
    </footer>
  );
}
