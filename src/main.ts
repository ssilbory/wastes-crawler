import { render } from 'preact';
import { h } from 'preact';
import { App } from './ui/builder/App.tsx';
import './ui/builder/builder.css';

const root = document.querySelector<HTMLElement>('#app');
if (root) render(h(App, null), root);
