import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    host: true,
    port: 5177,
    proxy: {
      '/TTB': {
        target: 'http://127.0.0.1:8079',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/TTB/, '')
      }
    }

  }
})
