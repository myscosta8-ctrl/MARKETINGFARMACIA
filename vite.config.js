import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Ambientes: dev (local), homolog (branch preview), prod (main/GitHub Pages)
// base fixo na subpasta do repo, pois o GitHub Pages publica em
// https://<usuario>.github.io/MARKETINGFARMACIA/ (não na raiz do domínio).
export default defineConfig({
  base: '/MARKETINGFARMACIA/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Farma Marketing',
        short_name: 'FarmaMkt',
        description: 'Marketing, CRM e Inteligência Comercial para farmácias',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
