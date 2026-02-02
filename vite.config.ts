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
    // Fix for Recharts circular dependency issue
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // Optimize chunking for better LCP and reduced HTTP requests
    rollupOptions: {
      output: {
        // Add content hash to all assets for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          // Critical path optimization - keep main bundle small
          if (id.includes('node_modules')) {
            // Core React - smallest possible initial bundle
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'vendor-react';
            }
            if (id.includes('react-router-dom') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
            // Supabase - defer loading
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // TanStack Query
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // UI framework - Radix components bundled together
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // Animation library - deferred
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // PDF generation - only loaded when needed
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            // Charts - isolate recharts dependencies to avoid circular imports
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('d3-')) {
              return 'vendor-d3';
            }
            // Lucide icons - bundled together
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Other utilities
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'vendor-utils';
            }
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
