import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src/assets/media/logos/safra_base.png');
const resDir = path.join(
  root,
  'projects/terminal-mobile/android/app/src/main/res',
);

const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const launcherSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function writeIcon(folder, filename, size, padding = 0.12) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const resized = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: '#000000' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#000000',
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(path.join(resDir, folder, filename));
}

for (const [folder, size] of Object.entries(foregroundSizes)) {
  await writeIcon(folder, 'ic_launcher_foreground.png', size, 0.08);
  await writeIcon(folder, 'ic_launcher.png', launcherSizes[folder], 0.08);
  await writeIcon(folder, 'ic_launcher_round.png', launcherSizes[folder], 0.08);
}

console.log('Android launcher icons generated from safra_base.png');
