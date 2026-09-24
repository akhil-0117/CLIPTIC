import puppeteer, { Browser } from "puppeteer";

let sharedBrowser: Browser | null = null;
let browserReady: Promise<Browser> | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.connected) {
    if (!browserReady) {
      browserReady = puppeteer
        .launch({
          headless: "new" as any,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-web-security",
          ],
        })
        .then((b) => {
          sharedBrowser = b;
          return b;
        });
    }
    sharedBrowser = await browserReady;
  }
  return sharedBrowser;
}

// Warm the browser up at boot so the first render is fast.
void getSharedBrowser().catch(() => {});

// Serialize renders through one queue — puppeteer pages share one browser
// process and concurrent renders cause stalls. FIFO order keeps it fair.
let renderQueue: Promise<unknown> = Promise.resolve();

function queuedRender<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(fn, fn);
  renderQueue = run.catch(() => {});
  return run as Promise<T>;
}

export async function renderHtmlToImage(
  html: string,
  width: number = 1600,
  height: number = 960
): Promise<Buffer | null> {
  return queuedRender(() => renderNow(html, width, height));
}

async function renderNow(html: string, width: number, height: number): Promise<Buffer | null> {
  let page = null;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    // domcontentloaded: our cards are pure inline-CSS HTML with no external
    // resources — waiting for "load" only wastes time.
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });
    console.log(`[ImageGen] Rendered ${Math.round(buffer.length / 1024)}KB`);
    return Buffer.from(buffer);
  } catch (error: any) {
    console.error("[ImageGen] Failed:", error?.message || error);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

process.on("exit", () => {
  if (sharedBrowser) void sharedBrowser.close();
});
