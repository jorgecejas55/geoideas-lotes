# GEO IDEAS · Lotes (PWA)

App web instalable en el celular para ver en el campo los **ambientes de aptitud** (producto de 4 y de 8 campañas), el **ensayo recomendado** y el **límite del lote**, con la **ubicación GPS** del dispositivo. Funciona **sin conexión** una vez abierta.

Stack: Next.js 16 (exportación estática) · React 19 · MapLibre GL · service worker propio.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000 (sin service worker)
npm run build      # genera /out + out/sw.js (precarga sin conexión)
npm start          # sirve /out en http://localhost:3000
```

## Publicar (HTTPS obligatorio para usar el GPS)

**Vercel (recomendado):** subir el repo a GitHub → vercel.com → *Add New Project* → importar. Framework: Next.js. No requiere variables de entorno.

**Alternativa sin repo:** `npm run build` y arrastrar la carpeta `out/` a app.netlify.com/drop. Cualquier hosting estático con HTTPS sirve.

## Uso en el campo

1. Abrir la app **con señal** y recorrer el lote en el mapa con algo de zoom: las imágenes satelitales vistas quedan guardadas para usarse sin conexión.
2. Instalarla: Android/Chrome → menú ⋮ → *Instalar app* · iPhone/Safari → Compartir → *Agregar a inicio*.
3. En el lote: botón de ubicación. La tarjeta inferior indica distancia y rumbo al ensayo, si estás dentro, y el ambiente donde estás parado.

Las capas vectoriales y la app quedan siempre disponibles sin conexión; sin señal, el fondo satelital solo se muestra en las zonas ya vistas.

## Agregar un lote nuevo

```
public/data/
  lotes.json                      ← listado (id, nombre, ubicacion, cliente, ha)
  <id-del-lote>/
    meta.json                     ← bbox, datos del ensayo (centro, vértices), textos de productos
    limite.geojson                ← polígono del lote
    franja30.geojson              ← línea de exclusión de 30 m
    ensayo.geojson                ← polígono del ensayo
    ambientes_8c.geojson          ← polígonos con propiedad "clase" (1 bajo, 2 medio, 3 alto), "nombre", "ha", "pct"
    ambientes_4c.geojson
    escurrimiento.geojson         ← opcional: vías de escurrimiento (se activa con "capas": ["escurrimiento"] en meta.json)
```

`lotes.json` también lleva `ensayo` (texto con las medidas), `contorno` y `ensayoPoly` (coordenadas para la silueta de la tarjeta). Cada lote genera su página estática en `/lote/<id>/` a partir de este listado.

Todo en WGS84 (EPSG:4326). La pantalla inicial muestra una tarjeta por lote. Después de agregar datos: `npm run build` y volver a publicar (el service worker actualiza la versión solo).

## Límites de esta versión

- Precisión del GPS del celular: ±3–15 m. Para el replanteo definitivo, GPS de precisión.
- Fondo satelital: Esri World Imagery (en línea, guardado a medida que se ve). Para un fondo 100 % sin conexión conviene generar una imagen propia (p. ej. Sentinel-2) por lote.
- Los datos son públicos para quien tenga el enlace (sin usuarios ni contraseña).
