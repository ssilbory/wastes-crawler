import { useEffect, useState } from 'preact/hooks';

/** The phone layout's width (src/ui/theme/mobile.css). */
export const PHONE = '(max-width: 760px)';

/** Whether a media query matches now, kept up to date as the window changes. */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const change = () => setOn(list.matches);
    change();
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [query]);
  return on;
}
