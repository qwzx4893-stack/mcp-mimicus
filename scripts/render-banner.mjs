import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await sharp('assets/mimicus-banner.svg')
  .png({ compressionLevel: 9, palette: true, colours: 256 })
  .toFile('assets/mimicus-banner.png');
if (process.argv.includes('--proofs')) {
  await mkdir('.mimicus/banner-proof', { recursive: true });
  for (const width of [900, 390])
    await sharp('assets/mimicus-banner.svg')
      .resize({ width })
      .png()
      .toFile(`.mimicus/banner-proof/${width}.png`);
  for (const [name, background] of [
    ['light', '#ffffff'],
    ['dark', '#0d1117'],
  ])
    await sharp('assets/mimicus-banner.svg')
      .resize({ width: 900 })
      .extend({ top: 24, bottom: 24, left: 24, right: 24, background })
      .png()
      .toFile(`.mimicus/banner-proof/${name}.png`);
  console.log('Rendered 900px README and 390px mobile proofs under ignored .mimicus/banner-proof/');
}
console.log('Rendered the original 1800×720 editable SVG to assets/mimicus-banner.png');
