import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Plugin to ensure _headers file is in dist with correct format
const headersPlugin = (): Plugin => ({
  name: 'generate-headers',
  writeBundle() {
    const headersContent = `# Cache static assets for 1 year (immutable)
/assets/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff

# Fonts
/*.woff2
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

/*.woff
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

# Images with hash
/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Cache-Control: public, max-age=31536000, immutable

/*.ico
  Cache-Control: public, max-age=31536000, immutable

# HTML - no cache to always get latest
/
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/*.html
  Cache-Control: no-cache, no-store, must-revalidate

# Security headers for all routes
/*
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
`;
    fs.writeFileSync('dist/_headers', headersContent);
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    headersPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Content hash for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // Simplified chunking - fewer, larger chunks = more reliable loading
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Core React bundle - always needed
            if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router-dom') || id.includes('@remix-run')) {
              return 'vendor-core';
            }
            // UI components together
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            // Data layer
            if (id.includes('@supabase') || id.includes('@tanstack')) {
              return 'vendor-data';
            }
            // Heavy optional libs (PDF, charts) - loaded on demand
            if (id.includes('jspdf') || id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-heavy';
            }
            // Utils bundled together
            return 'vendor-utils';
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: mode === 'development',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
    ],
  },
}));
