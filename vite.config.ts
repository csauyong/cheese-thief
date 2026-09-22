import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/cheese-thief/
export default defineConfig({
  base: '/cheese-thief/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '奶酪大盜 Cheese Thief',
        short_name: '奶酪大盜',
        description: '奶酪大盜的線上版本，一支手機就能玩。An online companion for the board game Cheese Thief.',
        lang: 'zh-Hant',
        start_url: '/cheese-thief/',
        scope: '/cheese-thief/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12100e',
        theme_color: '#12100e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
