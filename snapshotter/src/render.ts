import { chromium } from "playwright";
import { createHash } from "node:crypto";

export interface Snapshot {
  bytes: Buffer;
  sha256: string;
  capturedAtMs: number;
}

// Day 3 TODO: bundle screenshot + raw HTML + response headers into a single
// archive (tar or zip) so the receipt preserves more than just an image.
export async function renderUrl(url: string): Promise<Snapshot> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const png = await page.screenshot({ fullPage: true });
    const sha256 = createHash("sha256").update(png).digest("hex");
    return { bytes: png, sha256, capturedAtMs: Date.now() };
  } finally {
    await browser.close();
  }
}
