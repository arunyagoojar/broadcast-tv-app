import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/imdb': {
        target: 'https://v3.sg.media-imdb.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const q = url.searchParams.get('q') || '';
          return `/suggestion/x/${encodeURIComponent(q)}.json`;
        }
      }
    }
  }
})

