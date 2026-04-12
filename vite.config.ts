import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";
import fs from "fs";

// Plugin to make CSS non-blocking since critical CSS is already inlined in index.html
const asyncCssPlugin = (): Plugin => ({
  name: 'async-css',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(
      /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
      (match, href) => {
        return `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">\n    <noscript><link rel="stylesheet" href="${href}"></noscript>`;
      }
    );
  }
});

// Plugin to inject modulepreload hints for critical vendor chunks
// and preload the critical font to break the CSS→font chain
const modulePreloadPlugin = (): Plugin => ({
  name: 'critical-modulepreload',
  enforce: 'post',
  transformIndexHtml(html, ctx) {
    if (!ctx.bundle) return html;
    
    const criticalChunks = ['vendor-react', 'vendor-router', 'vendor-utils'];
    const preloadTags: string[] = [];
    
    for (const [fileName] of Object.entries(ctx.bundle)) {
      if (criticalChunks.some(name => fileName.includes(name))) {
        preloadTags.push(`<link rel="modulepreload" href="/${fileName}">`);
      }
      // Preload Space Grotesk font (critical for LCP — breaks CSS→font chain)
      if (fileName.includes('space-gro') && fileName.endsWith('.woff2')) {
        preloadTags.push(`<link rel="preload" as="font" type="font/woff2" href="/${fileName}" crossorigin>`);
      }
    }
    
    if (preloadTags.length > 0) {
      return html.replace('</head>', `    ${preloadTags.join('\n    ')}\n  </head>`);
    }
    return html;
  }
});

// Plugin to ensure _headers file is in dist with correct format
const headersPlugin = (): Plugin => ({
  name: 'generate-headers',
  writeBundle() {
    const headersContent = `# Cache static assets for 1 year (immutable) - hashed filenames
/assets/*
  Cache-Control: public, max-age=31536000, immutable
  X-Content-Type-Options: nosniff

# Fonts - long cache with CORS
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

# HTML - allow stale-while-revalidate for faster repeat LCP
/
  Cache-Control: public, max-age=0, must-revalidate, stale-while-revalidate=3600

/index.html
  Cache-Control: public, max-age=0, must-revalidate, stale-while-revalidate=3600

/*.html
  Cache-Control: public, max-age=0, must-revalidate, stale-while-revalidate=3600

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
    asyncCssPlugin(),
    modulePreloadPlugin(),
    headersPlugin(),
    // Bundle audit: generates stats.html to visualize chunk sizes
    mode === "production" && (visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }) as unknown as Plugin),
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
            // Router - needed for initial navigation
            if (id.includes('react-router-dom') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
            // Supabase - defer loading (large ~80KB)
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // TanStack Query - defer
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // UI framework - Radix components bundled together (defer)
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // Animation library - only load on demand (large ~60KB)
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // PDF generation - only loaded when needed (large ~140KB)
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            // html2canvas - only loaded on demand (large ~73KB)
            if (id.includes('html2canvas')) {
              return 'vendor-html2canvas';
            }
            // Charts - isolate recharts dependencies (large ~100KB)
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            // D3 - used by recharts (large ~50KB)
            if (id.includes('d3-')) {
              return 'vendor-d3';
            }
            // Lucide icons - tree-shake and bundle used ones
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Helmet - SEO (small, defer)
            if (id.includes('react-helmet-async')) {
              return 'vendor-seo';
            }
            // next-themes - small but can be deferred
            if (id.includes('next-themes')) {
              return 'vendor-theme';
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Core utilities - keep small
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'vendor-utils';
            }
            // DnD kit - only for profile page
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd';
            }
            // Embla carousel
            if (id.includes('embla-carousel')) {
              return 'vendor-carousel';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'vendor-forms';
            }
          }
        },
      },
    },
    // Increase chunk size warning limit (optimized chunks are larger but fewer)
    chunkSizeWarningLimit: 500,
    // Enable minification optimizations
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps only in dev
    sourcemap: mode === 'development',
    // Reduce bundle size with tree shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
    },
  },
  // Optimize dependencies - only include truly critical ones
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
    ],
    // Exclude heavy deps from pre-bundling to reduce initial load
    exclude: [
      'framer-motion',
      'jspdf',
      'jspdf-autotable',
      'html2canvas',
      'recharts',
    ],
  },
}));
