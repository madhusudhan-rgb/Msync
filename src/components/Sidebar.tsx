
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { ViewName } from '../lib/types';
import { Icon, type IconName } from './Icons';

const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'songs', label: 'Songs', icon: 'music' },
  { view: 'albums', label: 'Albums', icon: 'disc' },
  // { view: 'artists', label: 'Artists', icon: 'mic' },
  { view: 'videos', label: 'Videos', icon: 'film' },
  { view: 'settings', label: 'Settings', icon: 'settings' },
];

function isActive(view: ViewName, item: ViewName): boolean {
  if (view === item) return true;
  if (view === 'album' && item === 'albums') return true;
  if (view === 'artist' && item === 'artists') return true;
  return false;
}

const aside =
  'flex w-[58px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/[0.08] bg-[#0c0c0e] px-1 py-3 max-[680px]:fixed max-[680px]:inset-x-0 max-[680px]:bottom-0 max-[680px]:z-50 max-[680px]:h-[52px] max-[680px]:w-full max-[680px]:flex-row max-[680px]:justify-around max-[680px]:gap-0 max-[680px]:overflow-visible max-[680px]:border-r-0 max-[680px]:border-t max-[680px]:px-1 max-[680px]:py-1';

const brand =
  'grid h-9 w-9 shrink-0 place-items-center rounded-md mb-3 max-[680px]:hidden';

const nav =
  'flex w-full flex-col items-center gap-1 max-[680px]:flex-1 max-[680px]:flex-row max-[680px]:justify-around';

const navItem =
  'relative flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[5px] text-[#85858f] transition-colors hover:bg-gray-700 hover:text-white max-[680px]:h-full max-[680px]:flex-1 max-[680px]:flex-col max-[680px]:gap-0 max-[680px]:rounded-[5px]';

export function Sidebar() {
  const view = usePlayerValue((state) => state.view);
  const search = usePlayerValue((state) => state.search);
  const scanning = usePlayerValue((state) => state.scanning);
  const searching = search.trim().length > 0;

  return (
    <aside className={aside}>
      <button
        className={brand}
        onClick={() => player.setView('home')}
        title="Musicplayer"
      >
        <Icon name="note" size={18} className="text-[#1ed760]" />
      </button>

      <nav className={nav} aria-label="Library">
        {NAV.map((item) => {
          const active = !searching && isActive(view, item.view);

          return (
            <button
              key={item.view}
              className={`${navItem} ${
                active
                  ? 'bg-transparent text-white before:absolute before:left-[-4px] before:top-[9px] before:h-[22px] before:w-[2px] before:rounded-full before:bg-white'
                  : ''
              }`}
              onClick={() => player.setView(item.view)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                name={item.icon}
                className={`h-5 w-5 ${
                  active ? 'text-[#1ed760]' : ''
                }`}
              />
              <span className="hidden max-[680px]:block max-[680px]:text-[9px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 max-[680px]:hidden" />

      {scanning && (
        <span className="mb-2 text-[#a2a2ab] max-[680px]:hidden" title="Scanning library">
          <Icon name="spinner" size={14} className="animate-spin" />
        </span>
      )}
    </aside>
  );
}
