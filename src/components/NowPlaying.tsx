import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { formatTime, trackAlbum, trackArtist } from '../lib/utils';
import { Artwork } from './Artwork';
import { Icon } from './Icons';

export function NowPlayingView() {
  const current = usePlayerValue((state) => state.current);
  const playing = usePlayerValue((state) => state.playing);
  const shuffle = usePlayerValue((state) => state.shuffle);
  const repeat = usePlayerValue((state) => state.repeat);
  const duration = usePlayerValue((state) => state.duration);
  const queue = usePlayerValue((state) => state.queue);
  const queueIndex = usePlayerValue((state) => state.queueIndex);

  if (!current) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Icon name="play" size={28} />
        </span>
        <h2>Nothing playing</h2>
        <p>Choose something from your library and it will appear here.</p>
        <div className="empty-actions">
          <button className="button secondary" onClick={() => player.setView('songs')}>
            Browse songs
          </button>
        </div>
      </div>
    );
  }

  if (current.kind === 'video') {
    return (
      <div className="now-video-note">
        <Icon name="film" size={20} />
        <span>
          <strong>{current.title}</strong> is playing in the video stage. Pick another section
          from the sidebar to browse while it keeps playing.
        </span>
      </div>
    );
  }

  const upNext = queue.slice(queueIndex + 1, queueIndex + 8);

  return (
    <div className="now-playing">
      <div className="now-art-wrap">
        <Artwork
          path={current.path}
          seed={current.album ?? current.title}
          size="hero"
          className="now-art"
          alt={current.title}
        />
      </div>

      <div className="now-meta">
        <p className="eyebrow">Now playing</p>
        <h2 className="now-title">{current.title}</h2>
        <p className="now-sub">
          {trackArtist(current)} · {trackAlbum(current)}
        </p>

        <div className="now-controls">
          <button
            className={`icon-button large ${shuffle ? 'is-active' : ''}`}
            onClick={() => player.setShuffle(!shuffle)}
            title="Shuffle"
            aria-pressed={shuffle}
          >
            <Icon name="shuffle" size={20} />
          </button>
          <button
            className="icon-button large"
            onClick={() => void player.previous()}
            title="Previous"
          >
            <Icon name="previous" size={24} />
          </button>
          <button
            className="play-button huge"
            onClick={() => void player.toggle()}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={28} />
          </button>
          <button className="icon-button large" onClick={() => void player.next()} title="Next">
            <Icon name="next" size={24} />
          </button>
          <button
            className={`icon-button large ${repeat !== 'off' ? 'is-active' : ''}`}
            onClick={() => player.cycleRepeat()}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            aria-pressed={repeat !== 'off'}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} size={20} />
          </button>
        </div>

        <p className="now-detail">
          {current.ext.toUpperCase()} · {formatTime(duration || current.duration)}
        </p>
      </div>

      <section className="up-next">
        <div className="section-head">
          <h2>Up next</h2>
          <span className="section-meta">{upNext.length} queued</span>
        </div>
        {upNext.length ? (
          <ol className="up-next-list">
            {upNext.map((track, index) => {
              const position = queueIndex + 1 + index;
              return (
                <li key={track.id}>
                  <button onClick={() => void player.playIndex(position)}>
                    <Artwork
                      path={track.kind === 'audio' ? track.path : null}
                      seed={track.album ?? track.title}
                      size="xs"
                      lazy
                      alt={track.title}
                    />
                    <span className="up-next-text">
                      <span className="up-next-title">{track.title}</span>
                      <span className="up-next-sub">{trackArtist(track)}</span>
                    </span>
                    <span className="up-next-time">
                      {track.duration > 0 ? formatTime(track.duration) : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">
            {repeat === 'all'
              ? 'The queue will start again when this track ends.'
              : 'This is the last track in the queue.'}
          </p>
        )}
      </section>
    </div>
  );
}
