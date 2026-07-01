import * as cheerio from "cheerio";
import { getText, head, absUrl } from "./http.js";

// Best-effort hubdrive.tips resolver.
// hubdrive pages usually show a form/button that posts to /ajax.php or redirects
// through an intermediate page to a hubcloud (or direct CDN) link.
export async function resolveHubdrive(pageUrl) {
  const { text, url: finalUrl } = await getText(pageUrl, { referer: pageUrl });
  const $ = cheerio.load(text);

  // Look for a link to hubcloud or a direct media URL
  let target = null;
  $("a").each((_, el) => {
    if (target) return;
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absUrl(finalUrl, href);
    if (!abs) return;
    if (/hubcloud|\.mp4|\.mkv|\.m3u8/i.test(abs)) target = abs;
  });

  if (!target) {
    const m = text.match(/https?:\/\/[^\s"'<>]+?(?:hubcloud[^\s"'<>]*|\.(?:mp4|mkv|m3u8)[^\s"'<>]*)/i);
    if (m) target = m[0];
  }

  if (!target) return null;

  // If it's hubcloud, delegate
  if (/hubcloud/i.test(target)) {
    const { resolveHubcloud } = await import("./hubcloud.js");
    return await resolveHubcloud(target);
  }

  // Otherwise treat as direct
  try {
    const r = await head(target, { referer: finalUrl });
    const ct = r.headers.get("content-type") || "";
    const len = r.headers.get("content-length");
    return {
      stream: target,
      referer: finalUrl,
      filename: decodeURIComponent(target.split("/").pop()?.split("?")[0] || ""),
      size: len ? Number(len) : undefined,
      contentType: ct || undefined,
    };
  } catch {
    return { stream: target, referer: finalUrl };
  }
}
