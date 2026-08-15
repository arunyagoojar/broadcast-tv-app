import test from 'node:test';
import assert from 'node:assert/strict';

import { optimizeImageUrl } from '../src/utils/imageUrl.js';

test('artwork URLs request display-appropriate image sizes', () => {
  assert.equal(
    optimizeImageUrl('https://image.tmdb.org/t/p/w500/example.png', 300),
    'https://image.tmdb.org/t/p/w300/example.png',
  );
  assert.equal(
    optimizeImageUrl('https://upload.wikimedia.org/x/1200px-Logo.svg.png', 320),
    'https://upload.wikimedia.org/x/320px-Logo.svg.png',
  );
});
