import sharp from 'sharp';

await sharp('assets/mimicus-banner.svg').png().toFile('assets/mimicus-banner.png');
console.log('Rendered original editable SVG to assets/mimicus-banner.png');
