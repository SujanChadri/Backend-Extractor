import { fetch, Agent } from "undici";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const agent = new Agent({ connect: { timeout: 15000 } });

export async function get(url, { referer, redirect = "follow" } = {}) {
  const res = await fetch(url, {
    method: "GET",
    redirect,
    dispatcher: agent,
    headers: {
      "user-agent": UA,
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      ...(referer ? { referer } : {}),
    },
  });
  return res;
}

export async function getText(url, opts) {
  const r = await get(url, opts);
  return { status: r.status, url: r.url, text: await r.text(), headers: r.headers };
}

export async function head(url, { referer } = {}) {
  const r = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    dispatcher: agent,
    headers: { "user-agent": UA, ...(referer ? { referer } : {}) },
  });
  return r;
}

export function absUrl(base, href) {
  try { return new URL(href, base).toString(); } catch { return null; }
}
