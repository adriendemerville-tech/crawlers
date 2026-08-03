// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Project MCP server (kept from the Classic config; not bundled by the wrapper).
    plugins: [mcpPlugin()],
    ssr: {
      // react-helmet-async ships CJS as its node "main"; left external, the SSR
      // module runner can't see its named exports (HelmetProvider). Bundling it
      // makes Vite use the ESM build ("module" field) instead.
      noExternal: ["react-helmet-async"],
    },
    resolve: {
      alias: [
        // jspdf v4 exports only "node"/"browser" conditions, which the workerd SSR
        // resolver can't match. Point at the explicit ES build (exported via "./dist/*").
        // Exact-match regex: a plain string key also rewrites "jspdf/dist/..." imports,
        // producing a doubled path like jspdf/dist/jspdf.es.min.js/dist/jspdf.es.min.js.
        { find: /^jspdf$/, replacement: "jspdf/dist/jspdf.es.min.js" },
      ],
    },
  },
});
