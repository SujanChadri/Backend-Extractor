import express from "express";
import cors from "cors";
import { resolveHubcloud } from "./extractors/hubcloud.js";
import { resolveHubdrive } from "./extractors/hubdrive.js";

const app = express();
app.use(cors());

app.get("/", (_req, res) => res.json({ ok: true, service: "hub-extractor" }));

app.get("/extract", async (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url) return res.status(400).json({ ok: false, error: "Missing url" });

  let host;
  try { host = new URL(url).hostname.toLowerCase(); }
  catch { return res.status(400).json({ ok: false, error: "Invalid url" }); }

  try {
    let result = null;
    if (host.includes("hubcloud")) result = await resolveHubcloud(url);
    else if (host.includes("hubdrive")) result = await resolveHubdrive(url);
    else return res.status(400).json({ ok: false, error: "Unsupported host" });

    if (!result || !result.stream) {
      return res.status(404).json({ ok: false, error: "Link Invalid or Expired" });
    }
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error("extract error:", e?.message);
    return res.status(502).json({ ok: false, error: "Link Invalid or Expired" });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`extractor on :${port}`));
