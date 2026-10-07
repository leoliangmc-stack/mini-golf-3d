import { byId } from './ui/dom';
import { TEXT } from './ui/i18n';

/**
 * Entry point. Deliberately tiny: it puts the start screen up at once, then pulls in
 * the engine (three.js, the physics WASM and the game itself) in the background.
 * The first tap doubles as the user gesture browsers require before playing sound.
 */
const start = byId<HTMLButtonElement>('start-button');
byId('start-title').textContent = TEXT.title();
byId('start-tagline').textContent = TEXT.tagline();
byId('rotate-text').textContent = TEXT.rotate();
start.textContent = TEXT.loading();

import('./app/app')
  .then(({ createApp }) => createApp(byId<HTMLCanvasElement>('view')))
  .then((app) => {
    start.textContent = TEXT.tapToStart();
    start.disabled = false;
    start.addEventListener(
      'click',
      () => {
        byId('start').hidden = true;
        app.start();
      },
      { once: true },
    );
  })
  .catch((error) => {
    console.error(error);
    start.textContent = 'Failed to start. Please reload.';
  });
