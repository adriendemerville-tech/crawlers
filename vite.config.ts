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
        manualChunks: (id) => {
          // Isolate ExpertAudit components to their own chunk (loaded only on /audit-expert)
          if (id.includes('src/components/ExpertAudit/')) {
            return 'page-audit-expert';
          }
          // Core React vendors - loaded first (critical)
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // Animation library - deferred via lazy loading
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // Radix UI components - bundled together
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui';
          }
          // Data & state management
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/@supabase')) {
            return 'vendor-data';
          }
          // PDF generation - only loaded when needed
          if (id.includes('node_modules/jspdf')) {
            return 'vendor-pdf';
          }
          // Charts - only loaded when needed
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'vendor-charts';
          }
          // Lucide icons - bundled together
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Other node_modules go to a common vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor-common';
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
