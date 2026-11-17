// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

interface RollupWarningLike {
  code?: string;
  message?: string;
  [key: string]: unknown;
}

function suppressModuleDirectiveWarnings(
  warning: RollupWarningLike,
  defaultHandler: (w: RollupWarningLike) => void,
) {
  if (
    warning.code === "MODULE_LEVEL_DIRECTIVE" ||
    warning.message?.includes('"use client"') ||
    warning.message?.includes("module level directive")
  ) {
    return;
  }
  defaultHandler(warning);
}

export default defineConfig({
  nitro: {
    preset: "node-server",
    traceDeps: [
      "firebase-admin*",
      "@google-cloud/firestore*",
      "@google-cloud/storage*",
      "@google-cloud/projectify*",
      "@google-cloud/promisify*",
      "@google-cloud/paginator*",
      "@grpc/grpc-js*",
      "@grpc/proto-loader*",
      "google-gax*",
    ],
    traceOpts: {
      nft: {
        ignore: ["**/node_modules/node-domexception/**"],
      },
      transform: [
        {
          filter: (id: string) =>
            id.endsWith("/fetch-blob/from.js") || id.endsWith("\\fetch-blob\\from.js"),
          handler: (code: string) =>
            code.replace(
              /import\s+DOMException\s+from\s+['"]node-domexception['"]\s*;?/,
              "const DOMException = globalThis.DOMException;",
            ),
        },
      ],
    },
    rollupConfig: {
      onwarn: suppressModuleDirectiveWarnings,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    build: {
      rollupOptions: {
        onwarn: suppressModuleDirectiveWarnings,
      },
    },
  },
});
