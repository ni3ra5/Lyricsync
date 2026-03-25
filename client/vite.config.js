import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': 'http://localhost:3002',
      '/audio': 'http://localhost:3002',
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
      },
    },
  },
});
