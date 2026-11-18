import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { ViewName } from '../lib/types';
import { Icon, type IconName } from './Icons';

const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'songs', label: 'Songs', icon: 'music' },
  { view: 'albums', label: 'Albums', icon: 'disc' },
  { view: 'artists', label: 'Artists', icon: 'mic' },
  { view: 'videos', label: 'Videos', icon: 'film' },
];

function isActive(view: ViewName, item: ViewName): boolean {
  if (view === item) return true;
  if (view === 'album' && item === 'albums') return true;
  if (view === 'artist' && item === 'artists') return true;
  return false;
}

const aside =
  'flex flex-col gap-2 overflow-y-auto border-r border-white/[0.08] bg-[#0c0c0e] px-3 py-4 max-[900px]:items-stretch max-[900px]:gap-[10px] max-[900px]:px-[10px] max-[680px]:fixed max-[680px]:inset-x-0 max-[680px]:bottom-0 max-[680px]:z-50 max-[680px]:h-[58px] max-[680px]:flex-row max-[680px]:items-center max-[680px]:gap-[2px] max-[680px]:overflow-visible max-[680px]:border-r-0 max-[680px]:border-t max-[680px]:px-[6px] max-[680px]:py-1';
const brand =
  'flex items-center gap-[10px] px-2 pb-3 text-left max-[900px]:justify-center max-[900px]:px-0 max-[680px]:hidden';
const nav =
  'flex flex-col gap-[2px] max-[680px]:flex-1 max-[680px]:flex-row max-[680px]:items-center max-[680px]:justify-around';
const navItem =
  'flex w-full items-center gap-3 rounded-[10px] px-[10px] py-[9px] text-left text-[13.5px] font-medium text-[#a2a2ab] transition-colors hover:bg-[#141417] hover:text-white max-[900px]:justify-center max-[900px]:p-[10px] max-[680px]:flex-1 max-[680px]:flex-col max-[680px]:gap-[2px] max-[680px]:px-2 max-[680px]:py-[5px] max-[680px]:text-[10px]';

export function Sidebar() {
  const view = usePlayerValue((state) => state.view);
  const search = usePlayerValue((state) => state.search);
  const scanning = usePlayerValue((state) => state.scanning);
  const searching = search.trim().length > 0;

  return (
    <aside className={aside}>
      <button className={brand} onClick={() => player.setView('home')} title="Musicplayer">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#1ed760] text-[#04140a]">
          <Icon name="note" size={18} />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.02em] max-[900px]:hidden">
          Musicplayer
        </span>
      </button>

      <nav className={nav} aria-label="Library">
        {NAV.map((item) => {
          const active = !searching && isActive(view, item.view);
          return (
            <button
              key={item.view}
              className={`${navItem} ${
                active ? 'bg-[#1b1b1f] text-white [&>svg]:text-[#1ed760]' : ''
              }`}
              onClick={() => player.setView(item.view)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} className="h-4 w-4 max-[900px]:h-5 max-[900px]:w-5 max-[680px]:h-[19px] max-[680px]:w-[19px]" />
              <span className="block max-[900px]:hidden max-[680px]:block max-[680px]:text-[9.5px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 max-[680px]:hidden" />

      {scanning ? (
        <span className="inline-flex items-center gap-[6px] text-[11.5px] text-[#a2a2ab] max-[680px]:hidden">
          <Icon name="spinner" size={13} className="h-3 w-3 animate-spin" /> Scanning…
        </span>
      ) : null}
    </aside>
  );
}
