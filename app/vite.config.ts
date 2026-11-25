import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` makes one self-contained index.html (for hosting as a single page).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    mode === 'single'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'Ironrow',
            short_name: 'Ironrow',
            description: 'Your own workout logger. Works offline, keeps data on your device.',
            theme_color: '#0a0a0c',
            background_color: '#0a0a0c',
            display: 'standalone',
            start_url: './',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
            ],
          },
        }),
  ],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
