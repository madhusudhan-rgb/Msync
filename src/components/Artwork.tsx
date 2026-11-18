import { useEffect, useRef, useState } from 'react';
import { loadArtwork } from '../lib/backend';
import { Icon } from './Icons';

interface ArtworkProps {
  path?: string | null;
  seed: string;
  alt?: string;
  shape?: 'square' | 'round';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  lazy?: boolean;
  className?: string;
}

const sizes: Record<ArtworkProps['size'] & string, string> = {
  xs: 'h-7 w-7 rounded-md',
  sm: 'h-10 w-10 rounded-md',
  md: 'h-[52px] w-[52px] rounded-lg',
  lg: 'h-[176px] w-[176px] rounded-xl max-[720px]:h-[120px] max-[720px]:w-[120px]',
  hero: 'aspect-square w-full rounded-[14px]',
};

export function Artwork({
  path,
  seed: _seed,
  alt = '',
  shape = 'square',
  size = 'md',
  lazy: _lazy = false,
  className = '',
}: ArtworkProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [prevPath, setPrevPath] = useState<string | null | undefined>(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setSrc(null);
  }

  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    void loadArtwork(path).then((art) => {
      if (!cancelled) setSrc(art);
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const radius = shape === 'round' ? 'rounded-full' : sizes[size].match(/rounded[^\s]*/)?.[0] ?? 'rounded-lg';
  const shapeSize = shape === 'round' ? sizes[size].replace(/rounded[^\s]*/g, '').trim() : sizes[size];

  return (
    <span
      ref={holder}
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-[#17171a] text-white/[0.32] ${shapeSize} ${radius} ${className}`}
      title={alt || undefined}
    >
      {src ? (
        <img src={src} alt={alt} draggable={false} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <Icon name="note" size={size === 'xs' ? 14 : size === 'sm' ? 17 : 22} />
        </span>
      )}
    </span>
  );
}
