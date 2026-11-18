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
  lazy = false,
  className = '',
}: ArtworkProps) {
  const [loaded, setLoaded] = useState<{ path: string; src: string | null } | null>(null);
  const holder = useRef<HTMLSpanElement>(null);
  const src = loaded && loaded.path === path ? loaded.src : null;

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    const load = () => {
      void loadArtwork(path).then((art) => {
        if (!cancelled) setLoaded({ path, src: art });
      });
    };

    const element = holder.current;
    if (!lazy || !element || typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [path, lazy]);

  const radius = shape === 'round' ? 'rounded-full' : sizes[size].match(/rounded[^\s]*/)?.[0] ?? 'rounded-lg';
  const shapeSize = shape === 'round' ? sizes[size].replace(/rounded[^\s]*/g, '').trim() : sizes[size];

  return (
    <span
      ref={holder}
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-white/[0.08] bg-[#17171a] text-white/[0.32] ${shapeSize} ${radius} ${className}`}
      title={alt || undefined}
    >
      {src ? (
        <img src={src} alt={alt} draggable={false} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center">
          <Icon name="note" size={size === 'xs' ? 14 : size === 'sm' ? 17 : 22} />
        </span>
      )}
    </span>
  );
}
