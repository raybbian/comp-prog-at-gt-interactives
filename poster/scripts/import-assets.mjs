// Copies the poster's photography and wordmarks out of the club website and
// resizes them for a booth screen. Everything the poster shows comes from
// competitiveprogrammingatgt.com; nothing here is drawn or invented locally, so
// re-run this after the site's art changes rather than editing src/assets by hand.
//
//   node poster/scripts/import-assets.mjs [path-to-comp-prog-at-gt]
//
// Needs ImageMagick 7 (`magick`) on PATH. Photos are re-encoded to JPEG at twice
// their largest on-screen size, which covers a 4K panel scaling the 1920x1080
// canvas by two. Wordmarks are SVG and copy across untouched.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(process.argv[2] ?? join(here, '../../../comp-prog-at-gt'));
const out = resolve(join(here, '../src/assets'));

const PHOTOS = [
  { from: 'images/lesson-pizza.jpg', to: 'practice.jpg', width: 1200 },
  { from: 'images/citadel-2026.jpg', to: 'lecture.jpg', width: 1200 },
  { from: 'images/icpc-2024-closeup.png', to: 'competition.jpg', width: 1200 },
];

// Matches `companies` in the site's src/data/companies.ts. Radix Trading has no
// logo file there and renders as a wordmark, so it is absent here too.
const LOGOS = [
  'jane-street.svg',
  'google.svg',
  'amazon.svg',
  'optiver.svg',
  'citadel.svg',
  'hrt.svg',
];

mkdirSync(join(out, 'logos'), { recursive: true });

for (const { from, to, width } of PHOTOS) {
  execFileSync('magick', [
    join(site, 'public', from),
    '-resize', `${width}x`,
    '-strip',
    '-quality', '82',
    '-interlace', 'Plane',
    join(out, to),
  ]);
  console.log(`photo  ${from} -> ${to}`);
}

for (const logo of LOGOS) {
  copyFileSync(join(site, 'public/logos', logo), join(out, 'logos', logo));
  console.log(`logo   ${logo}`);
}
