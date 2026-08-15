import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Full aspect mode fills the complete screen and crops provider letterboxing', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const fullWrapRule = css.match(/body\.ar-full #player-wrap\s*\{([^}]*)\}/)?.[1] || '';
  const fullContainerRule = css.match(/body\.ar-full #player-container\s*\{([^}]*)\}/)?.[1] || '';

  assert.equal(fullWrapRule, '');
  assert.match(css, /body\.ar-fit #player-wrap,[\s\S]*body\.ar-full #player-wrap,[\s\S]*body\.ar-stretch #player-wrap\s*\{[^}]*width:\s*100%/);
  assert.match(fullContainerRule, /width:\s*max\(100%,\s*calc\(100dvh \* 16 \/ 9\)\)/);
  assert.match(fullContainerRule, /height:\s*max\(100%,\s*calc\(100vw \* 9 \/ 16\)\)/);
  assert.match(fullContainerRule, /scale\(1\.3\)/);
});

test('Stretch scales a rendered 16:9 player surface to the screen height', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const stretchRule = css.match(/body\.ar-stretch #player-container\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(stretchRule, /height:\s*calc\(100vw \* 9 \/ 16\)/);
  assert.match(stretchRule, /scaleY\(var\(--screen-stretch-y\)\)/);
});

test('the embedded player overscans vertically to keep provider controls off-screen', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const playerRule = css.match(/#player\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(playerRule, /top:\s*-15%/);
  assert.match(playerRule, /height:\s*130%\s*!important/);
});

test('mobile HUD uses a smaller title image', async () => {
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  const mobileRules = css.match(/@media \(max-width: 950px\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(mobileRules, /\.hud-logo\s*\{[^}]*max-height:\s*60px/s);
  assert.match(mobileRules, /max-width:\s*180px/);
});
