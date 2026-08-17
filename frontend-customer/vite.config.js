import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self' ws://localhost:5174; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.js'],
    globals: true
  }
})
