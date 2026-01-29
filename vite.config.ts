import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunking for better LCP and reduced HTTP requests
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendors - loaded first
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI framework - Radix components bundled together
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-select',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-toast',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-separator',
            '@radix-ui/react-progress',
            '@radix-ui/react-avatar',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
          ],
          // Animation library - deferred
          'vendor-motion': ['framer-motion'],
          // Data & state management
          'vendor-data': ['@tanstack/react-query', '@supabase/supabase-js'],
          // Heavy utilities - lazy loaded
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          // PDF generation - only loaded when needed
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          // Charts - only loaded when needed
          'vendor-charts': ['recharts'],
          // Lucide icons - bundled together
          'vendor-icons': ['lucide-react'],
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
