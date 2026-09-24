/**
 * CLIPTIC logo resolution order:
 * 1. Real brand PNG (generated from src/IMG_20260918_231013.webp by
 *    scripts/convert-logo.js) — used when the asset exists.
 * 2. Inline SVG recreation — fallback so a logo always renders.
 *
 * Both are embedded data URIs, so the logo can never 404 or expire.
 */

let realLogo: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  realLogo = require("./logoAsset").LOGO_DATA_URI;
} catch {}

export { realLogo as REAL_LOGO_DATA_URI };

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="clg1" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#efe9ff"/><stop offset="1" stop-color="#b9a3ff"/>
</linearGradient>
<linearGradient id="clg2" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7c4dff"/><stop offset="1" stop-color="#3d1e8f"/>
</linearGradient>
<radialGradient id="clg3" cx="0.5" cy="0.08" r="0.9">
<stop offset="0" stop-color="#6d3fd6" stop-opacity="0.55"/><stop offset="1" stop-color="#6d3fd6" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="512" height="512" rx="108" fill="#050308"/>
<rect width="512" height="512" rx="108" fill="url(#clg3)"/>
<rect x="14" y="14" width="484" height="484" rx="98" fill="none" stroke="#a78bfa" stroke-opacity="0.55" stroke-width="6"/>
<g>
<path d="M136 154 l52 -38 q22 -16 38 6 l14 20 -104 76 -14 -20 q-16 -22 14 -44 Z" fill="url(#clg1)"/>
<path d="M212 102 l52 -38 q22 -16 38 6 l14 20 -104 76 -14 -20 q-16 -22 14 -44 Z" fill="url(#clg1)"/>
<path d="M288 50 l52 -38 q22 -16 38 6 l14 20 -104 76 -14 -20 q-16 -22 14 -44 Z" fill="url(#clg1)"/>
</g>
<rect x="108" y="212" width="296" height="200" rx="56" fill="url(#clg2)"/>
<rect x="108" y="212" width="296" height="200" rx="56" fill="none" stroke="#c4b0ff" stroke-opacity="0.35" stroke-width="4"/>
<path d="M234 268 l92 44 -92 44 Z" fill="#0b0618"/>
<circle cx="256" cy="256" r="150" fill="none" stroke="#8b5cff" stroke-opacity="0.18" stroke-width="24"/>
</svg>`;

/**
 * The logo data URI used everywhere — the real brand icon when available,
 * otherwise the SVG recreation.
 */
export const LOGO_DATA_URI =
  realLogo || `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;
