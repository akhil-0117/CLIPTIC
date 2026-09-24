// One-time asset pipeline: downscale src/IMG_20260918_231013.webp to a small
// 128x128 PNG and emit src/utils/logoAsset.ts with it as a base64 data URI.
// Run: node scripts/convert-logo.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

(async () => {
  const srcPath = path.join(__dirname, "..", "src", "IMG_20260918_231013.webp");
  if (!fs.existsSync(srcPath)) {
    console.error("Source logo not found:", srcPath);
    process.exit(1);
  }

  const b64in = fs.readFileSync(srcPath).toString("base64");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 256, height: 256, deviceScaleFactor: 1 });
    await page.setContent(
      `<body style="margin:0"><img id="i" src="data:image/webp;base64,${b64in}" style="width:128px;height:128px;object-fit:contain"/></body>`,
      { waitUntil: "load" }
    );
    await new Promise((r) => setTimeout(r, 800));
    const dataUri = await page.evaluate(() => {
      const img = document.getElementById("i");
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      c.getContext("2d").drawImage(img, 0, 0, 128, 128);
      return c.toDataURL("image/png");
    });
    const ts = `/**
 * CLIPTIC logo — real brand icon, downscaled to 128px and embedded as a
 * base64 PNG data URI. Generated once by scripts/convert-logo.js from
 * src/IMG_20260918_231013.webp. Do not edit by hand.
 *
 * Embedded (rather than a CDN link) so it can never 404 or expire.
 */
export const LOGO_DATA_URI =
  "${dataUri}";
`;
    fs.writeFileSync(path.join(__dirname, "..", "src", "utils", "logoAsset.ts"), ts);
    console.log(`logoAsset.ts written (${Math.round(dataUri.length / 1024)}KB data URI)`);
  } finally {
    await browser.close();
  }
})();
