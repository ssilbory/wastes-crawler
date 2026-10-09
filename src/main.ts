// The theme loads first so each screen's own styles build on it.
import './ui/theme/fonts.ts';
import './ui/theme/theme.css';
import './ui/theme/controls.css';
import { h, render } from 'preact';
import { Shell } from './ui/Shell.tsx';
import './ui/builder/builder.css';
import './ui/app-menu.css';
import './ui/arena/setup.css';
import './ui/arena/fight.css';
import './ui/world/layout.css';
import './ui/world/world.css';
import './ui/world/hex-map.css';
import './ui/town/town.css';
import './ui/theme/screens.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) render(h(Shell, null), root);
