import * as cheerio from "cheerio";
import { getText, head, absUrl } from "./http.js";

// Best-effort hubcloud.cx resolver.
// hubcloud pages typically embed a "Download" / "Instant DL" / "Fast Cloud" button
// that points to a direct .mp4/.mkv on a CDN, or to a second page that does.
export async function resolveHubcloud(pageUrl) {
  const visited = new Set();
  let current = pageUrl;

  for (let hop = 0; hop < 4; hop++) {
    if (visited.has(current)) break;
    visited.add(current);

    const { text, url: finalUrl } = await getText(current, { referer: current });
    const $ = cheerio.load(text);

    // 1. Direct media link in <a href> or <source src>
    const direct = findDirectMedia($, finalUrl);
    if (direct) return await confirm(direct, finalUrl);

    // 2. Collect candidate buttons
    const candidates = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const label = ($(el).text() || "").toLowerCase();
      if (!href) return;
      const abs = absUrl(finalUrl, href);
      if (!abs) return;
      if (/download|instant|fast.?cloud|cloud.?download|resume|server|stream/i.test(label)) {
        candidates.push(abs);
      }
    });

    // 3. window.location redirect in inline script
    const scriptRedirect = extractScriptRedirect(text, finalUrl);
    if (scriptRedirect) candidates.unshift(scriptRedirect);

    // Prefer direct media candidates first
    const mediaCand = candidates.find((u) => /\.(mp4|mkv|m3u8|webm)(\?|$)/i.test(u));
    if (mediaCand) return await confirm(mediaCand, finalUrl);

    if (candidates.length === 0) return null;
    current = candidates[0];
  }
  return null;
}

function findDirectMedia($, base) {
  const selectors = [
    'source[src*=".mp4"]', 'source[src*=".mkv"]', 'source[src*=".m3u8"]',
    'video[src*=".mp4"]', 'a[href*=".mp4"]', 'a[href*=".mkv"]', 'a[href*=".m3u8"]',
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const u = el.attr("src") || el.attr("href");
      const abs = absUrl(base, u);
      if (abs) return abs;
    }
  }
  return null;
}

function extractScriptRedirect(html, base) {
  const patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /href\s*=\s*["'](https?:\/\/[^"']+\.(?:mp4|mkv|m3u8)[^"']*)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return absUrl(base, m[1]);
  }
  return null;
}

async function confirm(url, referer) {
  try {
    const r = await head(url, { referer });
    const ct = r.headers.get("content-type") || "";
    const len = r.headers.get("content-length");
    if (r.ok && (/^video\//i.test(ct) || /octet-stream|mpegurl|matroska|mp4/i.test(ct) || /\.(mp4|mkv|m3u8|webm)(\?|$)/i.test(url))) {
      return {
        stream: url,
        referer,
        filename: decodeURIComponent(url.split("/").pop()?.split("?")[0] || ""),
        size: len ? Number(len) : undefined,
        contentType: ct || undefined,
      };
    }
  } catch {}
  // Fallback: still return, let the player try
  return { stream: url, referer };
}
