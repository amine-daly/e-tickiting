import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const iconSource = path.join(root, "src/assets/media/logos/safra_base.png");
const splashSource = path.join(root, "src/assets/media/logos/safra_dark.png");
const resDir = path.join(
  root,
  "projects/terminal-mobile/android/app/src/main/res",
);

/** Adaptive-icon safe zone ≈ 66% of canvas — keep artwork inside it. */
const FOREGROUND_PADDING = 0.18;
const LEGACY_PADDING = 0.18;

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const launcherSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const splashPortrait = {
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [1080, 1920],
  "drawable-port-xxxhdpi": [1440, 2560],
};

const splashLandscape = {
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1920, 1080],
  "drawable-land-xxxhdpi": [2560, 1440],
};

async function writeIcon(folder, filename, size, padding) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const resized = await sharp(iconSource)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(path.join(resDir, folder, filename));
}

async function writeSplash(folder, width, height) {
  const logoMaxWidth = Math.round(Math.min(width, height) * 0.62);
  const logoBuffer = await sharp(splashSource)
    .resize(logoMaxWidth, null, { fit: "inside" })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();
  const left = Math.round((width - logoMeta.width) / 2);
  const top = Math.round((height - logoMeta.height) / 2);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toFile(path.join(resDir, folder, "splash.png"));
}

for (const [folder, size] of Object.entries(foregroundSizes)) {
  await writeIcon(
    folder,
    "ic_launcher_foreground.png",
    size,
    FOREGROUND_PADDING,
  );
  await writeIcon(
    folder,
    "ic_launcher.png",
    launcherSizes[folder],
    LEGACY_PADDING,
  );
  await writeIcon(
    folder,
    "ic_launcher_round.png",
    launcherSizes[folder],
    LEGACY_PADDING,
  );
}

for (const [folder, [width, height]] of Object.entries(splashPortrait)) {
  await writeSplash(folder, width, height);
}

for (const [folder, [width, height]] of Object.entries(splashLandscape)) {
  await writeSplash(folder, width, height);
}

await writeSplash("drawable", 480, 800);

console.log("Android launcher icons and splash screens generated.");
