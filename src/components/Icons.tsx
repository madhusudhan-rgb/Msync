import type { IconType } from 'react-icons';
import {
  IoAddOutline,
  IoCheckmarkOutline,
  IoChevronBackOutline,
  IoCloseOutline,
  IoDiscOutline,
  IoDocumentTextOutline,
  IoFilmOutline,
  IoFolderOpenOutline,
  IoHomeOutline,
  IoInfiniteOutline,
  IoListOutline,
  IoMicOutline,
  IoMusicalNoteOutline,
  IoMusicalNotesOutline,
  IoPause,
  IoPlay,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoReloadOutline,
  IoRepeatOutline,
  IoRefreshOutline,
  IoSearchOutline,
  IoShuffleOutline,
  IoTrashOutline,
  IoVolumeHighOutline,
  IoVolumeLowOutline,
  IoVolumeOffOutline,
} from 'react-icons/io5';

export type IconName =
  | 'home'
  | 'music'
  | 'disc'
  | 'mic'
  | 'film'
  | 'queue'
  | 'note'
  | 'play'
  | 'pause'
  | 'previous'
  | 'next'
  | 'shuffle'
  | 'repeat'
  | 'repeat-one'
  | 'volume'
  | 'volume-low'
  | 'mute'
  | 'folder-plus'
  | 'file-plus'
  | 'refresh'
  | 'search'
  | 'close'
  | 'trash'
  | 'chevron-left'
  | 'spinner'
  | 'check'
  | 'plus';

const ICONS: Record<IconName, IconType> = {
  home: IoHomeOutline,
  music: IoMusicalNotesOutline,
  disc: IoDiscOutline,
  mic: IoMicOutline,
  film: IoFilmOutline,
  queue: IoListOutline,
  note: IoMusicalNoteOutline,
  play: IoPlay,
  pause: IoPause,
  previous: IoPlaySkipBack,
  next: IoPlaySkipForward,
  shuffle: IoShuffleOutline,
  repeat: IoRepeatOutline,
  'repeat-one': IoInfiniteOutline,
  volume: IoVolumeHighOutline,
  'volume-low': IoVolumeLowOutline,
  mute: IoVolumeOffOutline,
  'folder-plus': IoFolderOpenOutline,
  'file-plus': IoDocumentTextOutline,
  refresh: IoRefreshOutline,
  search: IoSearchOutline,
  close: IoCloseOutline,
  trash: IoTrashOutline,
  'chevron-left': IoChevronBackOutline,
  spinner: IoReloadOutline,
  check: IoCheckmarkOutline,
  plus: IoAddOutline,
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps) {
  const Component = ICONS[name];
  return <Component size={size} className={className} aria-hidden="true" focusable="false" />;
}

export function Equalizer({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex h-[14px] w-[14px] shrink-0 origin-bottom items-end justify-center gap-[2px]"
      aria-hidden="true"
    >
      <span
        className={`h-1 w-[2.5px] origin-bottom rounded-sm bg-[#1ed760] ${
          active ? 'animate-pulse' : ''
        }`}
      />
      <span
        className={`h-[6px] w-[2.5px] origin-bottom rounded-sm bg-[#1ed760] ${
          active ? 'animate-pulse [animation-delay:180ms]' : ''
        }`}
      />
      <span
        className={`h-[5px] w-[2.5px] origin-bottom rounded-sm bg-[#1ed760] ${
          active ? 'animate-pulse [animation-delay:360ms]' : ''
        }`}
      />
    </span>
  );
}
