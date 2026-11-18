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

export function Sidebar() {
  const view = usePlayerValue((state) => state.view);
  const search = usePlayerValue((state) => state.search);
  const scanning = usePlayerValue((state) => state.scanning);
  const searching = search.trim().length > 0;

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => player.setView('home')} title="Musicplayer">
        <span className="brand-mark">
          <Icon name="note" size={18} />
        </span>
        <span className="brand-name">Musicplayer</span>
      </button>

      <nav className="nav" aria-label="Library">
        {NAV.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${!searching && isActive(view, item.view) ? 'is-active' : ''}`}
            onClick={() => player.setView(item.view)}
            title={item.label}
            aria-label={item.label}
            aria-current={!searching && isActive(view, item.view) ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      {scanning ? (
        <span className="scanning">
          <Icon name="spinner" size={13} className="spin" /> Scanning…
        </span>
      ) : null}
    </aside>
  );
}
