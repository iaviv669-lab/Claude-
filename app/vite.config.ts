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
          registerType: 'prompt',
          includeAssets: ['icon.svg'],
          manifest: {
            name: 'Repwise',
            short_name: 'Repwise',
            description: 'Your own workout logger. Works offline, keeps data on your device.',
            theme_color: '#0e1013',
            background_color: '#0e1013',
            display: 'standalone',
            start_url: './',
            icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
          },
        }),
  ],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
