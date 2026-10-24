// Before any zod schema is built (src/ui/zod-jitless.ts).
import './ui/zod-jitless.ts';
// The theme loads first so each screen's own styles build on it.
import './ui/theme/fonts.ts';
import './ui/theme/theme.css';
import './ui/theme/controls.css';
import { h, render } from 'preact';
import { Shell } from './ui/Shell.tsx';
import { installed, persistStorage, registerServiceWorker, watchInstallPrompt } from './ui/pwa.ts';
import './ui/builder/builder.css';
import './ui/app-menu.css';
import './ui/arena/setup.css';
import './ui/arena/fight.css';
import './ui/arena/fight-fx.css';
import './ui/world/layout.css';
import './ui/world/world.css';
import './ui/world/dungeon-view.css';
import './ui/world/dungeon-props.css';
import './ui/world/hex-map.css';
import './ui/world/hex-terrain.css';
import './ui/world/zoom-frame.css';
import './ui/town/town.css';
import './ui/world/popups.css';
import './ui/theme/screens.css';
// After the shared screen rules: the builder fits its window instead of scrolling.
import './ui/builder/wizard.css';
// The ⓘ descriptions' button and sheet (src/ui/hint.tsx), on every screen.
import './ui/hint.css';
// Last: phone and touch overrides of every screen's layout, all in one file.
import './ui/theme/mobile.css';

watchInstallPrompt();
registerServiceWorker();
// An installed game asks to keep its saves; in a tab, the About page offers it instead, since
// some browsers ask the player.
if (installed()) void persistStorage();

const root = document.querySelector<HTMLElement>('#app');
if (root) render(h(Shell, null), root);
