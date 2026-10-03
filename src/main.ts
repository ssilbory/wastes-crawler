import { h, render } from 'preact';
import { Shell } from './ui/Shell.tsx';
import './ui/builder/builder.css';
import './ui/arena/setup.css';
import './ui/arena/fight.css';
import './ui/world/world.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) render(h(Shell, null), root);
