import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Required for Excalidraw to work properly
    "process.env": {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || "development"),
    },
  },
});