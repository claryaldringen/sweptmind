import sharp from "sharp";
import { writeFileSync } from "fs";

// Lightning bolt SVG on dark rounded background
// Yellow-500 (#eab308) bolt on zinc-900 (#18181b) background
function createIconSvg(size) {
  const padding = Math.round(size * 0.15);
  const cornerRadius = Math.round(size * 0.22);

  // Lucide Zap outline path on white background
  const iconArea = size - padding * 2;
  const scale = iconArea / 24;
  const tx = padding;
  const ty = padding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#ffffff"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path d="M13 2 3 14h9l-1 10 10-12h-9l1-10z" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

// Maskable icon needs extra safe zone (10% padding on each side per spec)
function createMaskableIconSvg(size) {
  const padding = Math.round(size * 0.25); // extra padding for safe zone
  const iconArea = size - padding * 2;
  const scale = iconArea / 24;
  const tx = padding;
  const ty = padding;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <path d="M13 2 3 14h9l-1 10 10-12h-9l1-10z" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

// Favicon: outline bolt only (matches Lucide Zap icon style)
function createFaviconSvg(size) {
  const scale = size / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="scale(${scale})">
    <path d="M13 2 3 14h9l-1 10 10-12h-9l1-10z" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

async function main() {
  // Generate favicon.ico (just the bolt, no background)
  const ico16 = await sharp(Buffer.from(createFaviconSvg(16))).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(Buffer.from(createFaviconSvg(32))).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(Buffer.from(createFaviconSvg(48))).resize(48, 48).png().toBuffer();

  // Build ICO file (simple ICO format with PNG entries)
  const icoBuffer = buildIco([
    { size: 16, png: ico16 },
    { size: 32, png: ico32 },
    { size: 48, png: ico48 },
  ]);
  writeFileSync("src/app/favicon.ico", icoBuffer);
  console.log("Generated src/app/favicon.ico");

  // Generate PWA icons
  await sharp(Buffer.from(createIconSvg(192)))
    .resize(192, 192)
    .png()
    .toFile("public/icons/icon-192.png");
  console.log("Generated public/icons/icon-192.png");

  await sharp(Buffer.from(createIconSvg(512)))
    .resize(512, 512)
    .png()
    .toFile("public/icons/icon-512.png");
  console.log("Generated public/icons/icon-512.png");

  await sharp(Buffer.from(createMaskableIconSvg(512)))
    .resize(512, 512)
    .png()
    .toFile("public/icons/icon-512-maskable.png");
  console.log("Generated public/icons/icon-512-maskable.png");

  // Apple touch icon (180x180)
  await sharp(Buffer.from(createIconSvg(180)))
    .resize(180, 180)
    .png()
    .toFile("public/icons/apple-touch-icon.png");
  console.log("Generated public/icons/apple-touch-icon.png");
}

// Build a simple ICO file from PNG buffers
function buildIco(entries) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * entries.length;
  let dataOffset = headerSize + dirSize;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4); // count

  const dirEntries = [];
  const dataBuffers = [];

  for (const { size, png } of entries) {
    const dir = Buffer.alloc(dirEntrySize);
    dir.writeUInt8(size < 256 ? size : 0, 0); // width
    dir.writeUInt8(size < 256 ? size : 0, 1); // height
    dir.writeUInt8(0, 2); // color palette
    dir.writeUInt8(0, 3); // reserved
    dir.writeUInt16LE(1, 4); // color planes
    dir.writeUInt16LE(32, 6); // bits per pixel
    dir.writeUInt32LE(png.length, 8); // data size
    dir.writeUInt32LE(dataOffset, 12); // data offset
    dirEntries.push(dir);
    dataBuffers.push(png);
    dataOffset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

main().catch(console.error);
