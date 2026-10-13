import { defineConfig } from 'vite';

export default defineConfig({
  base: '/spelling/',
  build: {
    outDir: '../spelling',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        parent: 'parent/index.html'
      }
    }
  }
});
