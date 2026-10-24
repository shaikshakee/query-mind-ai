
const BACKEND_URL = (process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
const BACKEND_API_TOKEN = (process.env.BACKEND_API_TOKEN || "").trim();

const ALLOWED_PATHS = new Set([
  "/api/health",
  "/api/chat",
  "/api/upload",
  "/api/documents",
  "/api/clear-chat",
]);

export default async function handler(req, res) {
  if (!BACKEND_URL || !BACKEND_API_TOKEN) {
    return res.status(503).json({
      detail: "Backend proxy is not configured.",
    });
  }

  const incoming = new URL(req.url, "https://vercel.invalid");
  const targetPath =
    incoming.pathname === "/api/health"
      ? "/health"
      : incoming.pathname;

  if (!ALLOWED_PATHS.has(incoming.pathname)) {
    return res.status(404).json({ detail: "Endpoint not found." });
  }

  if (incoming.pathname === "/api/health" && req.method !== "GET") {
    return res.status(405).json({ detail: "Method not allowed." });
  }

  const url = `${BACKEND_URL}${targetPath}${incoming.search}`;

  try {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${BACKEND_API_TOKEN}`);

    const contentType = req.headers["content-type"];
    if (contentType) headers.set("Content-Type", contentType);

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : req,
      duplex: "half",
      redirect: "manual",
    });

    res.status(response.status);

    const responseType = response.headers.get("content-type");
    if (responseType) res.setHeader("Content-Type", responseType);

    const body = Buffer.from(await response.arrayBuffer());
    return res.send(body);
  } catch {
    return res.status(502).json({
      detail: "Could not reach the AI backend. Check the tunnel and backend.",
    });
  }
}

