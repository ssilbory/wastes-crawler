import { useEffect, useState } from 'preact/hooks';
import { AboutApp } from './about/AboutApp.tsx';
import { AppMenu, type Route } from './AppMenu.tsx';
import { HelpApp } from './help/HelpApp.tsx';
import { HintSheet } from './hint.tsx';
import { ArenaApp } from './arena/ArenaApp.tsx';
import { CharactersApp } from './builder/CharactersApp.tsx';
import { EditorApp } from './editor/EditorApp.tsx';
import { MapEditorApp } from './map-editor/MapEditorApp.tsx';
import { SettingsApp } from './settings/SettingsApp.tsx';
import { TitleApp } from './title/TitleApp.tsx';
import { WorldApp } from './world/WorldApp.tsx';

const routeOf = (hash: string): Route =>
  hash.startsWith('#/builder')
    ? 'builder'
    : hash.startsWith('#/arena')
      ? 'arena'
      : hash.startsWith('#/world')
        ? 'world'
        : hash.startsWith('#/settings')
          ? 'settings'
          : hash.startsWith('#/editor')
            ? 'editor'
            : hash.startsWith('#/maps')
              ? 'maps'
              : hash.startsWith('#/help')
                ? 'help'
                : hash.startsWith('#/about')
                  ? 'about'
                  : 'title';

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
      <HintSheet />
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
      ) : route === 'help' ? (
        <HelpApp />
      ) : route === 'about' ? (
        <AboutApp />
      ) : route === 'builder' ? (
        <CharactersApp />
      ) : (
        <TitleApp />
      )}
    </>
  );
}
