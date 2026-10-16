// Android launcher icons and splash screens with the SweptMind bolt (same as the PWA
// icons from generate-icons.mjs). Run: node scripts/generate-android-icons.mjs
import sharp from "sharp";
import { readdirSync, existsSync } from "fs";
import { join } from "path";

const RES = "apps/mobile/android/app/src/main/res";
const BOLT_COLOR = "#eab308"; // yellow-500
// Lucide Zap outline (24×24 viewBox); its box is x 3–21, y 2–24
const BOLT_PATH = "M13 2 3 14h9l-1 10 10-12h-9l1-10z";
const BOLT_CENTER = { x: 12, y: 13 };

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** SVG of the bolt centred on a canvas; `boltSize` is the width of the 24-unit bolt box. */
function boltSvg({ width, height, boltSize, background }) {
  const scale = boltSize / 24;
  const tx = width / 2 - BOLT_CENTER.x * scale;
  const ty = height / 2 - BOLT_CENTER.y * scale;
  const min = Math.min(width, height);
  const bg = {
    none: "",
    full: `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    rounded: `<rect width="${width}" height="${height}" rx="${Math.round(min * 0.22)}" fill="#ffffff"/>`,
    circle: `<circle cx="${width / 2}" cy="${height / 2}" r="${min / 2}" fill="#ffffff"/>`,
  }[background];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bg}
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path d="${BOLT_PATH}" fill="none" stroke="${BOLT_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log(`Generated ${file}`);
}

async function main() {
  for (const [density, factor] of Object.entries(DENSITIES)) {
    const dir = join(RES, `mipmap-${density}`);
    const launcher = Math.round(48 * factor); // legacy icons: 48dp
    const foreground = Math.round(108 * factor); // adaptive icon layer: 108dp, safe zone 66dp

    await render(
      boltSvg({
        width: launcher,
        height: launcher,
        boltSize: launcher * 0.7,
        background: "rounded",
      }),
      join(dir, "ic_launcher.png"),
    );
    await render(
      boltSvg({
        width: launcher,
        height: launcher,
        boltSize: launcher * 0.6,
        background: "circle",
      }),
      join(dir, "ic_launcher_round.png"),
    );
    // Background colour comes from values/ic_launcher_background.xml (#FFFFFF)
    await render(
      boltSvg({
        width: foreground,
        height: foreground,
        boltSize: foreground * 0.46,
        background: "none",
      }),
      join(dir, "ic_launcher_foreground.png"),
    );
  }

  // Splash screens (Android < 12; newer versions show the launcher icon) — keep each size
  const splashDirs = readdirSync(RES).filter(
    (d) => d.startsWith("drawable") && existsSync(join(RES, d, "splash.png")),
  );
  for (const dir of splashDirs) {
    const file = join(RES, dir, "splash.png");
    const { width, height } = await sharp(file).metadata();
    const boltSize = Math.min(width, height) * 0.22;
    await render(boltSvg({ width, height, boltSize, background: "full" }), file);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
