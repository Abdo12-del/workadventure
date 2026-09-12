/**
 * NG Academy brand rasterizer.
 *
 * Renders the vector brand sources (brand/app-mark.svg, brand/logo-lockup-white.svg)
 * to every PNG size the application expects. ImageMagick's SVG delegate is unreliable
 * across distributions, so we rasterize with `sharp` (libvips) instead.
 *
 * Usage: node brand/rasterize.mjs <tools-node-modules-dir>
 *
 * All outputs are quantized/stripped: the platform targets children on weak devices.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = process.argv[2];
if (!toolsDir) {
    console.error("usage: node brand/rasterize.mjs <node_modules dir containing sharp>");
    process.exit(2);
}
const require = createRequire(path.join(toolsDir, "sharp", "package.json"));
const sharp = require("sharp");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const MARK = path.join(here, "app-mark.svg");
const LOCKUP = path.join(here, "logo-lockup-white.svg");

const FAV = path.join(root, "play/public/static/images/favicons");
const IMAGES = path.join(root, "play/public/static/images");
const COMP = path.join(root, "play/src/front/Components/images");
const NG = path.join(IMAGES, "ng");

const png = (colors) => ({ palette: true, colors, compressionLevel: 9 });

async function render(svg, size, dest, { white = false, width, height, colors = 64 } = {}) {
    let pipeline = sharp(svg, { density: 192 }).resize(width ?? size, height ?? size, {
        fit: width && height ? "fill" : "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    if (white) {
        pipeline = pipeline.tint({ r: 255, g: 255, b: 255 });
    }
    await pipeline.png(png(colors)).toFile(dest);
}

const sizes = {
    android: [36, 48, 72, 96, 144, 192],
    apple: [57, 60, 72, 76, 114, 120, 144, 152, 180],
    ms: [70, 144, 150, 310],
};

for (const s of sizes.android) {
    await render(MARK, s, path.join(FAV, `android-icon-${s}x${s}.png`));
    await render(MARK, s, path.join(FAV, `android-icon-${s}x${s}-white.png`), { white: true, colors: 2 });
}
for (const s of sizes.apple) {
    await render(MARK, s, path.join(FAV, `apple-icon-${s}x${s}.png`));
    await render(MARK, s, path.join(FAV, `apple-icon-${s}x${s}-white.png`), { white: true, colors: 2 });
}
for (const s of sizes.ms) {
    await render(MARK, s, path.join(FAV, `ms-icon-${s}x${s}.png`));
}
for (const [name, size] of Object.entries({
    "apple-icon.png": 192,
    "apple-icon-white.png": 192,
    "apple-icon-precomposed.png": 192,
    "apple-icon-precomposed-white.png": 192,
    "favicon-16x16.png": 16,
    "favicon-16x16-white.png": 16,
    "favicon-32x32.png": 32,
    "favicon-32x32-white.png": 32,
    "favicon-96x96.png": 96,
    "favicon-96x96-white.png": 96,
    "icon-512x512.png": 512,
    "icon-512x512-white.png": 512,
})) {
    await render(MARK, size, path.join(FAV, name), { white: name.includes("-white"), colors: name.includes("-white") ? 2 : 64 });
}

await render(MARK, 128, path.join(IMAGES, "logo-WA-min.png"));
await render(MARK, 92, path.join(IMAGES, "logo-wa-2.png"));
await render(MARK, 144, path.join(COMP, "icon-workadventure-white.png"), { white: true, colors: 2 });
await render(MARK, 1024, path.join(NG, "icon-1024.png"));
await render(MARK, 180, path.join(here, "tmp-owl.png"));
await render(LOCKUP, undefined, path.join(IMAGES, "logo.png"), { width: 1086, height: 153 });

console.log("rasterized NG Academy brand assets");
