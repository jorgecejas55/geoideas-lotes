// Copia el worker de MapLibre a /public (el bundler no lo incluye automáticamente).
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('public/maplibre', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre/maplibre-gl-worker.mjs');
