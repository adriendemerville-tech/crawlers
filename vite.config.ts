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
  X-Frame-Options: DENY
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
    // Optimize chunking for better LCP and reduced HTTP requests
    rollupOptions: {
      output: {
        // Add content hash to all assets for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          // Core React - always needed
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // Supabase - needed early for auth
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // TanStack Query - needed for data fetching
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-query';
          }
          // UI components - loaded together
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // Animations - can be deferred
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // PDF - only loaded when needed
          if (id.includes('node_modules/jspdf')) {
            return 'vendor-pdf';
          }
          // Charts - only loaded when needed
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // Icons - needed for UI
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }
          // Drag and drop - only on profile page
          if (id.includes('node_modules/@dnd-kit')) {
            return 'vendor-dnd';
          }
        },
      },
    },
    // Increase chunk size warning limit (optimized chunks are larger but fewer)
    chunkSizeWarningLimit: 600,
    // Enable minification optimizations
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps only in dev
    sourcemap: mode === 'development',
  },
  // Optimize dependencies - only critical ones for faster cold start
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
    exclude: [
      'jspdf',
      'jspdf-autotable',
      'recharts',
    ],
  },
}));
