import { useEffect, useRef, useState } from 'react';
import { player } from '../lib/player';
import { usePlayerValue } from '../hooks/usePlayerValue';
import type { ViewName } from '../lib/types';
import { primaryButton } from '../lib/ui';
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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-5 border-b border-white/[0.08] bg-[#0a0a0b]/80 px-8 py-[14px] backdrop-blur-xl max-[1100px]:px-6 max-[720px]:gap-[10px] max-[720px]:px-4 max-[680px]:flex-wrap">
      <h1 className="truncate text-[18px] font-bold tracking-[-0.02em] max-[720px]:max-w-[26vw] max-[720px]:text-[17px] max-[680px]:max-w-none">
        {search.trim() ? 'Search' : headerTitle(view)}
      </h1>

      <div className="flex shrink-0 items-center gap-2 max-[680px]:flex-1 max-[680px]:justify-end">
        <label className="flex h-9 w-[260px] items-center gap-2 rounded-full border border-white/[0.08] bg-[#141417] px-3 text-[#6c6c75] transition-colors focus-within:border-white/[0.16] focus-within:bg-[#101012] max-[1100px]:w-[220px] max-[720px]:w-[150px] max-[680px]:min-w-[100px] max-[680px]:flex-1">
          <Icon name="search" size={16} />
          <input
            id="search-input"
            type="search"
            value={search}
            placeholder="Search"
            onChange={(event) => player.setSearch(event.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#f5f5f7] outline-none placeholder:text-[#6c6c75]"
          />
          {search ? (
            <button
              type="button"
              className="grid h-[22px] w-[22px] place-items-center rounded-full text-[#a2a2ab] transition hover:bg-[#1d1d21] hover:text-white"
              onClick={() => player.setSearch('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={13} />
            </button>
          ) : null}
        </label>

        <div className="relative flex items-center gap-2" ref={menuRef}>
          <button
            className={`${primaryButton} max-[720px]:w-9 max-[720px]:px-0`}
            onClick={() => setMenuView(menuOpen ? null : view)}
            title="Add music"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Icon name="plus" size={17} />
            <span className="max-[720px]:hidden">Add</span>
          </button>

          {menuOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[200px] rounded-xl border border-white/[0.16] bg-[#141417] p-[6px] shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
              role="menu"
            >
              <button
                role="menuitem"
                className="flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[9px] text-left text-[12.5px] font-medium text-[#a2a2ab] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                onClick={() => run(() => player.addFolder())}
              >
                <Icon name="folder-plus" size={16} />
                Add folder
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[9px] text-left text-[12.5px] font-medium text-[#a2a2ab] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                onClick={() => run(() => player.addFiles())}
              >
                <Icon name="file-plus" size={16} />
                Add files
              </button>
              <div className="mx-[6px] my-[5px] h-px bg-white/[0.08]" />
              <button
                role="menuitem"
                disabled={scanning}
                className="flex w-full items-center gap-[10px] rounded-lg px-[10px] py-[9px] text-left text-[12.5px] font-medium text-[#a2a2ab] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                onClick={() => run(() => player.rescan())}
              >
                <Icon name="refresh" size={16} className={scanning ? 'animate-spin' : undefined} />
                <span>{scanning ? 'Scanning…' : 'Rescan library'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
