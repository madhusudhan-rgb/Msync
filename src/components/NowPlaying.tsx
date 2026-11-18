import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import { formatTime, trackAlbum, trackArtist } from '../lib/utils';
import {
  eyebrow,
  hugePlayButton,
  iconButton,
  muted,
  nowDetail,
  nowSub,
  nowTitle,
  secondaryButton,
  sectionHead,
  sectionMeta,
  sectionTitle,
  upNextButton,
  upNextSub,
  upNextTime,
  upNextTitle,
  emptyActions,
  emptyIcon,
  emptyState,
  emptyText,
  emptyTitle,
} from '../lib/ui';
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
      <div className={emptyState}>
        <span className={emptyIcon}>
          <Icon name="play" size={28} />
        </span>
        <h2 className={emptyTitle}>Nothing playing</h2>
        <p className={emptyText}>Choose something from your library and it will appear here.</p>
        <div className={emptyActions}>
          <button className={secondaryButton} onClick={() => player.setView('songs')}>
            Browse songs
          </button>
        </div>
      </div>
    );
  }

  if (current.kind === 'video') {
    return (
      <div className="mx-auto my-7 flex max-w-[520px] items-start gap-3 rounded-xl border border-white/[0.08] bg-[#141417] p-[18px] text-[13px] leading-relaxed text-[#a2a2ab]">
        <Icon name="film" size={20} />
        <span>
          <strong className="text-white">{current.title}</strong> is playing in the video stage.
          Pick another section from the sidebar to browse while it keeps playing.
        </span>
      </div>
    );
  }

  const upNext = queue.slice(queueIndex + 1, queueIndex + 8);

  return (
    <div className="grid grid-cols-[minmax(240px,360px)_minmax(0,1fr)] gap-10 pt-5 max-[720px]:grid-cols-1 max-[720px]:gap-5">
      <div className="relative max-[720px]:mx-auto max-[720px]:max-w-[320px]">
        <Artwork
          path={current.path}
          seed={current.album ?? current.title}
          size="hero"
          className="shadow-[0_34px_70px_rgba(0,0,0,0.5)]"
          alt={current.title}
        />
      </div>

      <div className="min-w-0 pt-[14px]">
        <p className={eyebrow}>Now playing</p>
        <h2 className={nowTitle}>{current.title}</h2>
        <p className={nowSub}>
          {trackArtist(current)} · {trackAlbum(current)}
        </p>

        <div className="mt-7 flex items-center gap-2">
          <button
            className={`${iconButton} h-11 w-11 ${shuffle ? 'text-[#1ed760]' : ''}`}
            onClick={() => player.setShuffle(!shuffle)}
            title="Shuffle"
            aria-pressed={shuffle}
          >
            <Icon name="shuffle" size={20} />
          </button>
          <button
            className={`${iconButton} h-11 w-11`}
            onClick={() => void player.previous()}
            title="Previous"
          >
            <Icon name="previous" size={24} />
          </button>
          <button
            className={hugePlayButton}
            onClick={() => void player.toggle()}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={28} />
          </button>
          <button
            className={`${iconButton} h-11 w-11`}
            onClick={() => void player.next()}
            title="Next"
          >
            <Icon name="next" size={24} />
          </button>
          <button
            className={`${iconButton} h-11 w-11 ${repeat !== 'off' ? 'text-[#1ed760]' : ''}`}
            onClick={() => player.cycleRepeat()}
            title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
            aria-pressed={repeat !== 'off'}
          >
            <Icon name={repeat === 'one' ? 'repeat-one' : 'repeat'} size={20} />
          </button>
        </div>

        <p className={nowDetail}>
          {current.ext.toUpperCase()} · {formatTime(duration || current.duration)}
        </p>
      </div>

      <section className="col-span-full mt-[18px]">
        <div className={sectionHead}>
          <h2 className={sectionTitle}>Up next</h2>
          <span className={sectionMeta}>{upNext.length} queued</span>
        </div>
        {upNext.length ? (
          <ol>
            {upNext.map((track, index) => {
              const position = queueIndex + 1 + index;
              return (
                <li key={track.id}>
                  <button className={upNextButton} onClick={() => void player.playIndex(position)}>
                    <Artwork
                      path={track.kind === 'audio' ? track.path : null}
                      seed={track.album ?? track.title}
                      size="xs"
                      lazy
                      alt={track.title}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className={upNextTitle}>{track.title}</span>
                      <span className={upNextSub}>{trackArtist(track)}</span>
                    </span>
                    <span className={upNextTime}>
                      {track.duration > 0 ? formatTime(track.duration) : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={muted}>
            {repeat === 'all'
              ? 'The queue will start again when this track ends.'
              : 'This is the last track in the queue.'}
          </p>
        )}
      </section>
    </div>
  );
}
