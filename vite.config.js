import { defineConfig } from 'vite';

const githubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: githubPages ? '/noltap/' : '/',
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

