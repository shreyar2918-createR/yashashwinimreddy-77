import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(".output/public");
const distDir = path.resolve("dist");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
}

const fallbackHtmlPath = path.join(distDir, "index.html");
if (!fs.existsSync(fallbackHtmlPath)) {
  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VINORA — Idea to Impact</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  fs.writeFileSync(fallbackHtmlPath, fallbackHtml, "utf-8");
}

console.log("Postbuild static asset sync completed successfully.");
