import { useEffect, useState } from 'preact/hooks';
import { AppMenu, type Route } from './AppMenu.tsx';
import { ArenaApp } from './arena/ArenaApp.tsx';
import { App as BuilderApp } from './builder/App.tsx';
import { EditorApp } from './editor/EditorApp.tsx';
import { MapEditorApp } from './map-editor/MapEditorApp.tsx';
import { SettingsApp } from './settings/SettingsApp.tsx';
import { WorldApp } from './world/WorldApp.tsx';

const routeOf = (hash: string): Route =>
  hash.startsWith('#/arena')
    ? 'arena'
    : hash.startsWith('#/world')
      ? 'world'
      : hash.startsWith('#/settings')
        ? 'settings'
        : hash.startsWith('#/editor')
          ? 'editor'
          : hash.startsWith('#/maps')
            ? 'maps'
            : 'builder';

export function Shell() {
  const [route, setRoute] = useState<Route>(() => routeOf(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(routeOf(location.hash));
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <AppMenu route={route} />
      {route === 'arena' ? (
        <ArenaApp />
      ) : route === 'world' ? (
        <WorldApp />
      ) : route === 'settings' ? (
        <SettingsApp />
      ) : route === 'editor' ? (
        <EditorApp />
      ) : route === 'maps' ? (
        <MapEditorApp />
      ) : (
        <BuilderApp />
      )}
    </>
  );
}
