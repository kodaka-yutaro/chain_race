import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  envDir: '..',
  build: { outDir: '../dist', emptyOutDir: true, rollupOptions:{input:{main:'client/index.html',tutorial:'client/tutorial-preview.html'}} },
  server: { port: 5173 },
});
