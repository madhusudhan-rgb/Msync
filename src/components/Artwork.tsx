import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { loadArtwork } from '../lib/backend';
import { hashHue } from '../lib/utils';
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

export function Artwork({
  path,
  seed,
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

  const hue = hashHue(seed);
  const style = {
    '--art-hue': hue,
  } as CSSProperties;

  return (
    <span
      ref={holder}
      className={`artwork artwork-${size} artwork-${shape} ${className}`}
      style={style}
      title={alt || undefined}
    >
      {src ? (
        <img src={src} alt={alt} draggable={false} loading="lazy" />
      ) : (
        <span className="artwork-fallback">
          <Icon name="note" size={size === 'xs' ? 14 : size === 'sm' ? 17 : 22} />
        </span>
      )}
    </span>
  );
}
