import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Builds the two smoke entries for plain node ESM (every dependency bundled, so
 * MUI's directory imports do not need a bundler at runtime).
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  ssr: { noExternal: true },
  build: {
    ssr: true,
    outDir: 'smoke/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        ssrSmoke: fileURLToPath(new URL('./ssrSmoke.tsx', import.meta.url)),
        dataSmoke: fileURLToPath(new URL('./dataSmoke.tsx', import.meta.url)),
      },
      output: { format: 'es', entryFileNames: '[name].js' },
    },
  },
});
