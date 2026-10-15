// Full screen through the browser's Fullscreen API. iPhones have no element full screen; there
// the game goes full screen when it is added to the home screen (public/manifest.webmanifest).
import { useEffect, useState } from 'preact/hooks';

export function fullscreenAvailable(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Refused (no user gesture, or a browser policy): the page stays as it is.
  }
}

/** Whether the page is full screen now, kept current as the player or the browser changes it. */
export function useFullscreen(): boolean {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return on;
}
