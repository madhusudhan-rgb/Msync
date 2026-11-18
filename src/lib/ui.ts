/**
 * Shared Tailwind utility strings used inline by components. These are plain
 * utility classes — no component CSS — just de-duplicated across files.
 */

export const primaryButton =
  'inline-flex h-9 items-center justify-center gap-[7px] whitespace-nowrap rounded-full bg-[#1ed760] px-[18px] text-[13px] font-semibold text-[#04140a] transition hover:bg-[#2ce06c] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35';

export const secondaryButton =
  'inline-flex h-9 items-center justify-center gap-[7px] whitespace-nowrap rounded-full border border-white/[0.16] bg-[#141417] px-[18px] text-[13px] font-semibold text-white transition hover:bg-[#1d1d21] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35';

export const iconButton =
  'grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[#a2a2ab] transition hover:bg-white/[0.07] hover:text-white active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30';

export const playButton =
  'mx-1 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[#1ed760] text-[#04140a] transition hover:scale-105 hover:bg-[#2ce06c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35';

export const hugePlayButton =
  'mx-[10px] grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#1ed760] text-[#04140a] transition hover:scale-105 hover:bg-[#2ce06c] active:scale-95';

export const badge =
  'inline-flex h-4 shrink-0 items-center rounded bg-[#1ed760]/15 px-[5px] text-[8.5px] font-extrabold tracking-[0.08em] text-[#1ed760]';

export const emptyState =
  'mx-auto my-10 flex max-w-[540px] flex-col items-center gap-[10px] rounded-2xl border border-white/[0.08] bg-[#141417] p-9 text-center max-[680px]:my-7 max-[680px]:p-7';

export const emptyIcon =
  'mb-[6px] grid h-14 w-14 place-items-center rounded-full bg-[#1ed760]/15 text-[#1ed760]';

export const emptyTitle = 'text-[20px] font-bold tracking-[-0.02em]';

export const emptyText = 'max-w-[400px] text-[13px] leading-relaxed text-[#a2a2ab]';

export const emptyActions = 'mt-[14px] flex flex-wrap justify-center gap-2';

export const eyebrow =
  'text-[11px] font-bold uppercase tracking-[0.08em] text-[#6c6c75]';

export const section = 'mb-[34px]';

export const sectionHead = 'mb-[14px] flex items-baseline gap-[10px]';

export const sectionTitle = 'text-[16px] font-bold tracking-[-0.01em]';

export const sectionMeta = 'text-[12px] text-[#a2a2ab]';

export const muted = 'text-[13px] text-[#a2a2ab]';

export const linkButton = 'p-0 text-[#1ed760] underline underline-offset-[3px]';

export const backButton =
  'my-2 inline-flex items-center gap-[2px] rounded-full py-1 pl-1 pr-2 text-[12px] font-semibold text-[#a2a2ab] transition hover:bg-[#141417] hover:text-white';

export const cardGrid =
  'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-[22px] max-[900px]:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] max-[460px]:grid-cols-2';

export const mediaCard = 'group flex flex-col gap-1 text-left';

export const cardArt =
  'mb-[10px] aspect-square w-full rounded-[10px] border border-white/[0.08] transition-transform duration-200 group-hover:scale-[1.02]';

export const cardName = 'truncate text-[13px] font-semibold tracking-[-0.01em]';

export const cardSub = 'truncate text-[11.5px] text-[#6c6c75]';

export const detailHero =
  'flex items-end gap-[26px] pb-[26px] pt-2 max-[720px]:items-center max-[720px]:gap-4';

export const detailTitle =
  'text-[clamp(26px,3.4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.035em]';

export const detailSub = 'mt-[10px] text-[12.5px] text-[#a2a2ab]';

export const nowTitle =
  'text-[clamp(30px,4vw,52px)] font-extrabold leading-[1.04] tracking-[-0.04em]';

export const nowSub = 'mt-3 text-[15px] text-[#a2a2ab]';

export const nowDetail = 'mt-5 text-[11.5px] tracking-[0.06em] text-[#6c6c75]';

export const upNextButton =
  'grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-[6px] text-left transition hover:bg-[#141417]';

export const upNextTitle = 'truncate text-[12.5px] font-medium text-white';

export const upNextSub = 'truncate text-[11px] text-[#a2a2ab]';

export const upNextTime = 'text-[11px] tabular-nums text-[#6c6c75]';

export const queueCurrent =
  'flex max-w-[560px] items-center gap-[14px] rounded-xl border border-white/[0.08] bg-[#141417] p-3';

export const timeLabel =
  'min-w-[38px] shrink-0 text-center text-[10.5px] tabular-nums text-[#6c6c75] max-[680px]:min-w-[32px] max-[680px]:text-[10px]';

export const rangeInput =
  'h-4 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-50';

export const rangeTrack =
  '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#1ed760_0%,#1ed760_var(--fill),rgba(255,255,255,0.16)_var(--fill),rgba(255,255,255,0.16)_100%)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/[0.16] [&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[#1ed760]';

export const rangeThumb =
  '[&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white';

export const rangeThumbHover =
  'hover:[&::-webkit-slider-thumb]:opacity-100 focus-visible:[&::-webkit-slider-thumb]:opacity-100';
