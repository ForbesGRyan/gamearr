import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:7878',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:7878',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React into its own chunk for better caching
          'react-vendor': ['react', 'react-dom', '@tanstack/react-router'],
        },
      },
    },
    // Minimize CSS
    cssMinify: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
});
