import { useEffect, useState } from 'react';

function fit(width: number, height: number): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.innerWidth / width, window.innerHeight / height);
}

/**
 * Factor that fits a fixed design canvas inside the window, letterboxing whichever
 * axis is over-long. The poster is laid out once at a known size and scaled as a
 * whole, so a 1080p booth panel, a 4K lobby TV, and a laptop preview all show the
 * identical composition rather than a layout that reflows per screen.
 *
 * Seeded from the window rather than measured after mount, so the first paint is
 * already the right size.
 */
export function useFitScale(width: number, height: number): number {
  const [scale, setScale] = useState(() => fit(width, height));

  useEffect(() => {
    const update = (): void => setScale(fit(width, height));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [width, height]);

  return scale;
}
