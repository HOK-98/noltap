import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        parry: 'parry.html',
        pirate: 'pirate.html',
        about: 'about.html',
        contact: 'contact.html',
        privacy: 'privacy.html',
      },
    },
  },
});
