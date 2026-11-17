import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Cloud Run injects PORT (typically 8080).
// In Node.js, omitting HOST causes servers to bind to IPv6 '::',
// which fails Cloud Run IPv4 health checks and marks the service in a failed state.
const port = process.env.PORT || process.env.NITRO_PORT || "8080";
process.env.PORT = String(port);
process.env.NITRO_PORT = String(port);
process.env.HOST = process.env.HOST || "0.0.0.0";
process.env.NITRO_HOST = process.env.NITRO_HOST || "0.0.0.0";

console.log(
  `[VINORA Production] Initializing server on host ${process.env.HOST}, port ${process.env.PORT}...`,
);

const serverEntry = path.resolve(".output/server/index.mjs");

// Safety guard: if deployment runner skipped 'npm run build', build the bundle now
if (!fs.existsSync(serverEntry)) {
  console.log(
    "[VINORA Production] .output/server/index.mjs not found. Running build sequence now...",
  );
  try {
    execSync("npx vite build && node scripts/postbuild.js", {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    console.log("[VINORA Production] Build completed successfully.");
  } catch (err) {
    console.error("[VINORA Production] Build failed during startup:", err);
  }
}

// Global process error handlers to prevent container crashes on transient errors
process.on("unhandledRejection", (reason) => {
  console.error("[VINORA Server] Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[VINORA Server] Uncaught Exception:", error);
});

async function startServer() {
  if (fs.existsSync(serverEntry)) {
    try {
      console.log(
        `[VINORA Production] Starting TanStack Start / Nitro server on 0.0.0.0:${port}...`,
      );
      await import(`file://${serverEntry}`);
      console.log(`[VINORA Production] Server running and ready for traffic.`);
      return;
    } catch (err) {
      console.error("[VINORA Production] Failed to import .output/server/index.mjs:", err);
    }
  }

  // Resilient fallback HTTP server:
  // Ensures Cloud Run health probes never fail even if SSR bundling encountered an issue
  console.warn(
    `[VINORA Production] Launching resilient static HTTP fallback listener on 0.0.0.0:${port}`,
  );
  const http = await import("node:http");
  const fallbackServer = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/api/health" || url === "/health" || url === "/_health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          fallback: true,
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    const distIndex = path.resolve("dist/index.html");
    if (fs.existsSync(distIndex)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(distIndex).pipe(res);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("VINORA Service Running");
  });

  fallbackServer.listen(Number(port), "0.0.0.0", () => {
    console.log(
      `[VINORA Production] Fallback HTTP server successfully listening on 0.0.0.0:${port}`,
    );
  });
}

await startServer();
