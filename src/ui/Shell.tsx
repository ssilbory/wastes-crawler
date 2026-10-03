import { useEffect, useState } from 'preact/hooks';
import { ArenaApp } from './arena/ArenaApp.tsx';
import { App as BuilderApp } from './builder/App.tsx';

type Route = 'builder' | 'arena';

const routeOf = (hash: string): Route => (hash.startsWith('#/arena') ? 'arena' : 'builder');

export function Shell() {
  const [route, setRoute] = useState<Route>(() => routeOf(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(routeOf(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <nav class="top-nav" aria-label="Sections">
        <a href="#/builder" aria-current={route === 'builder' ? 'page' : undefined}>
          Character builder
        </a>
        <a href="#/arena" aria-current={route === 'arena' ? 'page' : undefined}>
          Arena
        </a>
      </nav>
      {route === 'arena' ? <ArenaApp /> : <BuilderApp />}
    </>
  );
}
