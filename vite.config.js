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
        knight: 'knight.html',
        knightGuide: 'knight-guide.html',
        parry: 'parry.html',
        pirate: 'pirate.html',
        about: 'about.html',
        contact: 'contact.html',
        privacy: 'privacy.html',
        dontClickGuide: 'dont-click-guide.html',
        parryGuide: 'parry-guide.html',
        pirateGuide: 'pirate-guide.html',
      },
    },
  },
});
