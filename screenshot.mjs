import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync } from "node:fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = process.argv[2] || "http://localhost:3000";
const label = process.argv[3] || "";
const scrollPct = process.argv[4] ? parseFloat(process.argv[4]) : null; // 0..1 scroll position
const OUT = "temporary screenshots";
mkdirSync(OUT, { recursive: true });

function nextName() {
  const existing = readdirSync(OUT).filter((f) => /^screenshot-\d+/.test(f));
  let max = 0;
  existing.forEach((f) => { const m = f.match(/^screenshot-(\d+)/); if (m) max = Math.max(max, +m[1]); });
  const n = max + 1;
  return `${OUT}/screenshot-${n}${label ? "-" + label : ""}.png`;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
const vw = parseInt(process.env.VW || "1440", 10);
const vh = parseInt(process.env.VH || "900", 10);
await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1, isMobile: vw < 768, hasTouch: vw < 768 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
// allow fonts + loader + animations to settle
await new Promise((r) => setTimeout(r, 3500));

if (scrollPct !== null) {
  const useCP = process.env.CP === "1";
  await page.evaluate((pct, useCP) => {
    let y;
    const c = document.getElementById("scroll-container");
    if (useCP && c) {
      y = c.offsetTop + pct * (c.offsetHeight - window.innerHeight);
    } else {
      y = (document.body.scrollHeight - window.innerHeight) * pct;
    }
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
    else window.scrollTo(0, y);
  }, scrollPct, useCP);
  await new Promise((r) => setTimeout(r, 2400));
}

const fullPage = process.env.FULL === "1" && scrollPct === null;
const file = nextName();
await page.screenshot({ path: file, fullPage });
console.log("saved", file);
await browser.close();
