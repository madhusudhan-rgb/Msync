import { useEffect, useRef, useState } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { ViewName } from '../lib/types';
import { Icon } from './Icons';

const TITLES: Record<string, string> = {
  home: 'Home',
  songs: 'Songs',
  albums: 'Albums',
  album: 'Albums',
  artists: 'Artists',
  artist: 'Artists',
  videos: 'Videos',
  queue: 'Queue',
  now: 'Now playing',
};

function headerTitle(view: ViewName): string {
  return TITLES[view] ?? 'Musicplayer';
}

export function Header() {
  const view = usePlayerValue((state) => state.view);
  const search = usePlayerValue((state) => state.search);
  const scanning = usePlayerValue((state) => state.scanning);
  const [menuView, setMenuView] = useState<ViewName | null>(null);
  const menuOpen = menuView === view;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuView(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuView(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const run = (action: () => void | Promise<void>) => {
    setMenuView(null);
    void action();
  };

  return (
    <header className="header">
      <div className="header-title">
        <h1>{search.trim() ? 'Search' : headerTitle(view)}</h1>
      </div>

      <div className="header-actions">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            id="search-input"
            type="search"
            value={search}
            placeholder="Search"
            onChange={(event) => player.setSearch(event.target.value)}
            spellCheck={false}
          />
          {search ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => player.setSearch('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={13} />
            </button>
          ) : null}
        </label>

        <div className="add-menu" ref={menuRef}>
          <button
            className="button primary"
            onClick={() => setMenuView(menuOpen ? null : view)}
            title="Add music"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="plus" size={17} />
            <span>Add</span>
          </button>

          {menuOpen ? (
            <div className="menu" role="menu">
              <button role="menuitem" onClick={() => run(() => player.addFolder())}>
                <Icon name="folder-plus" size={16} />
                <span>Add folder</span>
              </button>
              <button role="menuitem" onClick={() => run(() => player.addFiles())}>
                <Icon name="file-plus" size={16} />
                <span>Add files</span>
              </button>
              <div className="menu-separator" />
              <button
                role="menuitem"
                disabled={scanning}
                onClick={() => run(() => player.rescan())}
              >
                <Icon name="refresh" size={16} className={scanning ? 'spin' : undefined} />
                <span>{scanning ? 'Scanning…' : 'Rescan library'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
