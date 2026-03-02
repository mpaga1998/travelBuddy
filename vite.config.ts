import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: [
      'sparkishly-tauromachian-fe.ngrok-free.dev',
      '.ngrok-free.dev',  // Allow all ngrok-free URLs
      '.ngrok.app',       // Allow all ngrok.app URLs
      'localhost',
    ],
    cors: {
      origin: [
        'http://localhost:5173',
        '/https:\/\/.*\.ngrok.*/',      // Allow all ngrok URLs
        '/http:\/\/192\.168\..*/',      // Allow local network IPs
        '/http:\/\/10\..*/',            // Allow 10.x.x.x IPs
      ],
      credentials: true,
    },
  },
})
