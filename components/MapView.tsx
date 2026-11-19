'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as maplibregl from 'maplibre-gl';
type MLMap = maplibregl.Map;
type GeoJSONSource = maplibregl.GeoJSONSource;

if (typeof window !== 'undefined') maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
import { bearing, circle, distance, featureAt, fmtCoord, fmtDist, LngLat, pointInFeature, rumbo } from '@/lib/geo';

type Producto = '8c' | '4c' | 'none';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FC = any;

export interface LoteMeta {
  id: string;
  nombre: string;
  ubicacion: string;
  cliente: string;
  ha: number;
  bbox: [number, number, number, number];
  ensayo: { dim: string; ha: number; orient: number; centro: { lat: number; lon: number }; vertices: { lat: number; lon: number }[] };
  productos: Record<'8c' | '4c', string>;
  capas?: string[];
  escurrimientoDefault?: boolean;
}

const COLORS = { bajo: '#d73027', medio: '#fee05a', alto: '#1a9850', ensayo: '#00e5ff', gps: '#1a73e8', agua: '#2878e6' };
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const empty: FC = { type: 'FeatureCollection', features: [] };

export default function MapView({ meta }: { meta: LoteMeta }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Record<string, FC>>({});
  const [producto, setProducto] = useState<Producto>('8c');
  const [showEnsayo, setShowEnsayo] = useState(true);
  const [showLimite, setShowLimite] = useState(true);
  const tieneEsc = (meta.capas || []).includes('escurrimiento');
  const [showEsc, setShowEsc] = useState(!!meta.escurrimientoDefault);
  const [opacity, setOpacity] = useState(0.55);
  const [panel, setPanel] = useState(false);
  const [desk, setDesk] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 960px)').matches);
  const [collapsed, setCollapsed] = useState(false);
  const [cursor, setCursor] = useState<LngLat | null>(null);
  const [lotes, setLotes] = useState<{ id: string; nombre: string }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const router = useRouter();
  const [pos, setPos] = useState<{ p: LngLat; acc: number; t: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [online, setOnline] = useState(true);
  const watchId = useRef<number | null>(null);

  // Vista de escritorio
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 960px)');
    const upd = () => setDesk(mq.matches);
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);
  useEffect(() => {
    if (!desk || lotes.length) return;
    fetch('/data/lotes.json').then((r) => r.json()).then(setLotes).catch(() => {});
  }, [desk, lotes.length]);

  // Datos del lote
  useEffect(() => {
    const base = `/data/${meta.id}/`;
    Promise.all(['limite', 'franja30', 'ensayo', 'ambientes_8c', 'ambientes_4c', ...((meta.capas || []).includes('escurrimiento') ? ['escurrimiento'] : [])].map((n) => fetch(base + n + '.geojson').then((r) => r.json()).then((j) => [n, j] as const)))
      .then((pairs) => setData(Object.fromEntries(pairs)));
  }, [meta.id, meta.capas]);

  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => { window.removeEventListener('online', upd); window.removeEventListener('offline', upd); };
  }, []);

  // Mapa
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 16, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' },
        },
        layers: [
          { id: 'fondo', type: 'background', paint: { 'background-color': '#dfe6dc' } },
          { id: 'sat', type: 'raster', source: 'sat' },
        ],
      },
      bounds: meta.bbox,
      fitBoundsOptions: { padding: 40 },
      maxZoom: 19,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    const isDesk = window.matchMedia('(min-width: 960px)').matches;
    m.addControl(new maplibregl.NavigationControl({ showZoom: isDesk, visualizePitch: false }), 'top-right');
    let raf = 0;
    m.on('mousemove', (e) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setCursor([e.lngLat.lng, e.lngLat.lat])); });
    m.getCanvas().addEventListener('mouseleave', () => setCursor(null));
    const ro = new ResizeObserver(() => m.resize()); ro.observe(box.current);
    m.on('load', () => {
      const add = (id: string) => m.addSource(id, { type: 'geojson', data: empty });
      ['amb8', 'amb4', 'esc', 'limite', 'franja', 'ensayo', 'gps', 'gpsacc'].forEach(add);
      const ambPaint = (src: string, id: string) => {
        m.addLayer({ id, type: 'fill', source: src, paint: {
          'fill-color': ['match', ['get', 'clase'], 1, COLORS.bajo, 2, COLORS.medio, 3, COLORS.alto, '#999'],
          'fill-opacity': 0.55 } });
      };
      ambPaint('amb8', 'amb8-fill');
      ambPaint('amb4', 'amb4-fill');
      m.addLayer({ id: 'esc-fill', type: 'fill', source: 'esc', paint: { 'fill-color': COLORS.agua, 'fill-opacity': 0.7 } });
      m.addLayer({ id: 'franja-line', type: 'line', source: 'franja', paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
      m.addLayer({ id: 'limite-line', type: 'line', source: 'limite', paint: { 'line-color': '#ffffff', 'line-width': 2.5 } });
      m.addLayer({ id: 'ensayo-halo', type: 'line', source: 'ensayo', paint: { 'line-color': '#000000', 'line-width': 6, 'line-opacity': 0.5 } });
      m.addLayer({ id: 'ensayo-line', type: 'line', source: 'ensayo', paint: { 'line-color': COLORS.ensayo, 'line-width': 3.5 } });
      m.addLayer({ id: 'gpsacc-fill', type: 'fill', source: 'gpsacc', paint: { 'fill-color': COLORS.gps, 'fill-opacity': 0.15 } });
      m.addLayer({ id: 'gpsacc-line', type: 'line', source: 'gpsacc', paint: { 'line-color': COLORS.gps, 'line-width': 1, 'line-opacity': 0.6 } });
      m.addLayer({ id: 'gps-dot', type: 'circle', source: 'gps', paint: { 'circle-radius': 8, 'circle-color': COLORS.gps, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
      setReady(true);
    });
    m.on('dragstart', () => setFollow(false));
    map.current = m;
    return () => { ro.disconnect(); m.remove(); map.current = null; setReady(false); };
  }, [meta.bbox, desk]);

  // Cargar datos en las fuentes
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data.limite) return;
    (m.getSource('amb8') as GeoJSONSource).setData(data.ambientes_8c);
    (m.getSource('amb4') as GeoJSONSource).setData(data.ambientes_4c);
    (m.getSource('limite') as GeoJSONSource).setData(data.limite);
    (m.getSource('franja') as GeoJSONSource).setData(data.franja30);
    (m.getSource('ensayo') as GeoJSONSource).setData(data.ensayo);
    if (data.escurrimiento) (m.getSource('esc') as GeoJSONSource).setData(data.escurrimiento);
  }, [ready, data]);

  // Visibilidad y opacidad
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('amb8-fill', producto === '8c');
    vis('amb4-fill', producto === '4c');
    ['ensayo-halo', 'ensayo-line'].forEach((id) => vis(id, showEnsayo));
    ['limite-line', 'franja-line'].forEach((id) => vis(id, showLimite));
    vis('esc-fill', tieneEsc && showEsc);
    m.setPaintProperty('amb8-fill', 'fill-opacity', opacity);
    m.setPaintProperty('amb4-fill', 'fill-opacity', opacity);
  }, [ready, producto, showEnsayo, showLimite, showEsc, tieneEsc, opacity]);

  // GPS
  const startGps = useCallback(() => {
    if (!('geolocation' in navigator)) { setGpsError('Este dispositivo no tiene GPS disponible.'); return; }
    if (watchId.current !== null) return;
    setGpsError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (g) => { setGpsError(null); setPos({ p: [g.coords.longitude, g.coords.latitude], acc: g.coords.accuracy, t: g.timestamp }); },
      (e) => setGpsError(e.code === 1 ? 'Permiso de ubicación denegado. Habilitalo en el navegador.' : 'No se pudo obtener la ubicación. Probá a cielo abierto.'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  }, []);

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !pos) return;
    (m.getSource('gps') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pos.p } });
    (m.getSource('gpsacc') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(pos.p, Math.max(pos.acc, 1))] } });
    if (follow) m.easeTo({ center: pos.p, zoom: Math.max(m.getZoom(), 17), duration: 600 });
  }, [ready, pos, follow]);

  const onLocate = () => {
    startGps();
    setFollow(true);
    if (pos && map.current) map.current.easeTo({ center: pos.p, zoom: Math.max(map.current.getZoom(), 17) });
  };
  const onFit = () => { setFollow(false); map.current?.fitBounds(meta.bbox, { padding: 40 }); };
  const onEnsayo = () => {
    setFollow(false);
    const c = meta.ensayo.centro;
    map.current?.easeTo({ center: [c.lon, c.lat], zoom: 17.3 });
  };

  // Situación del usuario respecto del ensayo y los ambientes
  const info = useMemo(() => {
    if (!pos || !data.ensayo) return null;
    const c: LngLat = [meta.ensayo.centro.lon, meta.ensayo.centro.lat];
    const dentroEnsayo = pointInFeature(pos.p, data.ensayo.features[0]);
    const dentroLote = data.limite ? pointInFeature(pos.p, data.limite.features[0]) : false;
    const prod = producto === 'none' ? '8c' : producto;
    const amb = featureAt(pos.p, prod === '8c' ? data.ambientes_8c : data.ambientes_4c);
    return { d: distance(pos.p, c), b: bearing(pos.p, c), dentroEnsayo, dentroLote, amb: amb?.properties?.nombre as string | undefined, prod };
  }, [pos, data, producto, meta.ensayo.centro]);

  const copy = (txt: string, key?: string) => {
    navigator.clipboard?.writeText(txt).then(() => { if (key) { setCopied(key); setTimeout(() => setCopied(null), 1500); } }).catch(() => {});
  };
  const coordsTxt = () => meta.ensayo.vertices.map((v, i) => `V${i + 1}\t${v.lat}\t${v.lon}`).concat([`Centro\t${meta.ensayo.centro.lat}\t${meta.ensayo.centro.lon}`]).join('\n');
  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else el.requestFullscreen?.().catch(() => {});
  };
  const ambFC = producto === '8c' ? data.ambientes_8c : producto === '4c' ? data.ambientes_4c : null;
  const num = (v: unknown) => String(v).replace('.', ',');

  const ic = {
    locate: <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
    ensayo: <svg viewBox="0 0 24 24" width="22" height="22"><rect x="7" y="3" width="10" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>,
    fit: <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>,
    layers: <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3 2 8l10 5 10-5-10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
    side: <svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M9 4v16" stroke="currentColor" strokeWidth="2" /></svg>,
    full: <svg viewBox="0 0 24 24" width="22" height="22"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  };

  const capas = (
    <>
      <p className="lbl">Ambientes de aptitud</p>
      <div className="seg">
        {(['8c', '4c', 'none'] as Producto[]).map((k) => (
          <button key={k} className={producto === k ? 'on' : ''} onClick={() => setProducto(k)}>
            {k === '8c' ? '8 campañas' : k === '4c' ? '4 campañas' : 'Ocultar'}
          </button>
        ))}
      </div>
      {producto !== 'none' && <p className="hint">{meta.productos[producto]}</p>}
      <div className="legend">
        {[['Alto', COLORS.alto, 3], ['Medio', COLORS.medio, 2], ['Bajo', COLORS.bajo, 1]].map(([n, c, k]) => {
          const f = ambFC?.features?.find((x: FC) => x.properties.clase === k);
          return <div key={n as string} className="leg"><span className="sw" style={{ background: c as string }} />{n}{f && <span className="muted"> · {num(f.properties.ha)} ha ({num(f.properties.pct)} %)</span>}</div>;
        })}
      </div>
      <label className="row">Transparencia
        <input type="range" min={0.15} max={0.9} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)} />
      </label>
      <label className="row chk"><input type="checkbox" checked={showEnsayo} onChange={(e) => setShowEnsayo(e.target.checked)} /> <span className="sw line" style={{ background: COLORS.ensayo }} /> Ensayo recomendado</label>
      <label className="row chk"><input type="checkbox" checked={showLimite} onChange={(e) => setShowLimite(e.target.checked)} /> <span className="sw line" style={{ background: '#fff', outline: '1px solid #999' }} /> Límite del lote y franja de 30 m</label>
      {tieneEsc && <label className="row chk"><input type="checkbox" checked={showEsc} onChange={(e) => setShowEsc(e.target.checked)} /> <span className="sw" style={{ background: COLORS.agua }} /> Vías de escurrimiento (relieve)</label>}
    </>
  );

  const tabla = (
    <table className="coords">
      <thead><tr><th>Punto</th><th>Latitud</th><th>Longitud</th><th /></tr></thead>
      <tbody>
        {meta.ensayo.vertices.map((v, i) => (
          <tr key={i}><td>V{i + 1}</td><td>{fmtCoord(v.lat)}</td><td>{fmtCoord(v.lon)}</td><td><button className="mini" onClick={() => copy(`${v.lat}, ${v.lon}`, `v${i}`)}>{copied === `v${i}` ? '✓' : 'Copiar'}</button></td></tr>
        ))}
        <tr className="b"><td>Centro</td><td>{fmtCoord(meta.ensayo.centro.lat)}</td><td>{fmtCoord(meta.ensayo.centro.lon)}</td><td><button className="mini" onClick={() => copy(`${meta.ensayo.centro.lat}, ${meta.ensayo.centro.lon}`, 'c')}>{copied === 'c' ? '✓' : 'Copiar'}</button></td></tr>
      </tbody>
    </table>
  );

  const estado = (
    <>
      {!pos && !gpsError && <button className="cta" onClick={onLocate}>Activar mi ubicación</button>}
      {gpsError && !pos && <p className="warn">{gpsError}</p>}
      {gpsError && pos && <p className="warn small">Señal GPS intermitente: se muestra la última posición.</p>}
      {pos && info && (
        <div className="status">
          {info.dentroEnsayo ? <p className="big ok">Estás dentro del ensayo</p>
            : <p className="big">Ensayo a <b>{fmtDist(info.d)}</b> hacia el <b>{rumbo(info.b)}</b> ({Math.round(info.b)}°)</p>}
          <p className="sub">
            {info.dentroLote ? (info.amb ? <>Ambiente <b className={`amb-${info.amb.toLowerCase()}`}>{info.amb}</b> ({info.prod === '8c' ? '8 camp.' : '4 camp.'})</> : 'Dentro del lote') : 'Fuera del lote'}
            {' · '}precisión ±{Math.round(pos.acc)} m{pos.acc > 15 ? ' (baja)' : ''}
          </p>
        </div>
      )}
    </>
  );

  // ---------- Escritorio: geoportal con panel lateral ----------
  if (desk) {
    const otros = lotes.length > 1 ? lotes : [];
    return (
      <div className={`geo ${collapsed ? 'collapsed' : ''}`}>
        <aside className="side" aria-label="Panel del lote">
          <div className="side-scroll">
            <section className="sec lote">
              {otros.length > 0 && (
                <select className="selector" value={meta.id} onChange={(e) => router.push(`/lote/${e.target.value}/`)} aria-label="Cambiar de lote">
                  {otros.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              )}
              <dl className="ficha">
                <div><dt>Ubicación</dt><dd>{meta.ubicacion}</dd></div>
                <div><dt>Superficie</dt><dd>{num(meta.ha)} ha</dd></div>
                <div><dt>Cliente</dt><dd>{meta.cliente}</dd></div>
              </dl>
            </section>
            <section className="sec">
              <h3>Capas</h3>
              {capas}
            </section>
            <section className="sec">
              <h3>Ensayo recomendado</h3>
              <div className="kpis">
                <div><b>{meta.ensayo.dim}</b><span>medidas</span></div>
                <div><b>{num(meta.ensayo.ha)} ha</b><span>superficie</span></div>
                <div><b>{num(meta.ensayo.orient)}°</b><span>orientación</span></div>
              </div>
              {tabla}
              <div className="btns">
                <button className="btn" onClick={onEnsayo}>Ir al ensayo</button>
                <button className="btn ghost" onClick={() => copy(coordsTxt(), 'all')}>{copied === 'all' ? 'Copiadas ✓' : 'Copiar coordenadas'}</button>
              </div>
              <a className="link" href={`https://www.google.com/maps/dir/?api=1&destination=${meta.ensayo.centro.lat},${meta.ensayo.centro.lon}`} target="_blank" rel="noreferrer">Cómo llegar al ensayo →</a>
            </section>
            <section className="sec">
              <h3>Mi ubicación</h3>
              {estado}
            </section>
          </div>
          <footer className="side-foot">GEO IDEAS · NDVI Sentinel-2 (2018-2026) · coordenadas WGS84</footer>
        </aside>

        <div className="mapcol">
          <div ref={box} className="map" />
          {!online && <div className="badge offline">Sin conexión · capas disponibles</div>}
          <button className="toggle-side" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Mostrar panel' : 'Ocultar panel'} title={collapsed ? 'Mostrar panel' : 'Ocultar panel'}>{collapsed ? '›' : '‹'}</button>
          <div className="tools">
            <button className={`tool ${follow ? 'on' : ''}`} onClick={onLocate} title="Mi ubicación">{ic.locate}</button>
            <button className="tool" onClick={onEnsayo} title="Ir al ensayo">{ic.ensayo}</button>
            <button className="tool" onClick={onFit} title="Ver lote completo">{ic.fit}</button>
            <button className="tool" onClick={fullscreen} title="Pantalla completa (presentaciones)">{ic.full}</button>
          </div>
          {collapsed && producto !== 'none' && (
            <div className="minileg">
              <b>Ambientes · {producto === '8c' ? '8 campañas' : '4 campañas'}</b>
              {[['Alto', COLORS.alto], ['Medio', COLORS.medio], ['Bajo', COLORS.bajo]].map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}
              {showEnsayo && <span><i className="ln" style={{ background: COLORS.ensayo }} />Ensayo</span>}
              {tieneEsc && showEsc && <span><i style={{ background: COLORS.agua }} />Escurrimiento</span>}
            </div>
          )}
          {cursor && <div className="cursor">{fmtCoord(cursor[1])} ; {fmtCoord(cursor[0])}</div>}
        </div>
      </div>
    );
  }

  // ---------- Móvil (sin cambios) ----------
  return (
    <div className="mapwrap">
      <div ref={box} className="map" />

      {!online && <div className="badge offline">Sin conexión · capas disponibles</div>}

      <div className="fabs">
        <button className={`fab ${follow ? 'on' : ''}`} onClick={onLocate} aria-label="Mi ubicación" title="Mi ubicación">{ic.locate}</button>
        <button className="fab" onClick={onEnsayo} aria-label="Ir al ensayo" title="Ir al ensayo">{ic.ensayo}</button>
        <button className="fab" onClick={onFit} aria-label="Ver lote completo" title="Ver lote completo">{ic.fit}</button>
        <button className={`fab ${panel ? 'on' : ''}`} onClick={() => setPanel((v) => !v)} aria-label="Capas" title="Capas">{ic.layers}</button>
      </div>

      <div className="card">{estado}</div>

      {panel && (
        <div className="sheet" role="dialog" aria-label="Capas y leyenda">
          <div className="sheet-head">
            <b>Capas</b>
            <button className="x" onClick={() => setPanel(false)} aria-label="Cerrar">×</button>
          </div>
          {capas}
          <p className="lbl">Ensayo · {meta.ensayo.dim} · {num(meta.ensayo.ha)} ha · orientación {num(meta.ensayo.orient)}°</p>
          {tabla}
          <a className="link" href={`https://www.google.com/maps/dir/?api=1&destination=${meta.ensayo.centro.lat},${meta.ensayo.centro.lon}`} target="_blank" rel="noreferrer">Cómo llegar al ensayo (requiere conexión) →</a>
          <p className="fine">La ubicación del celular tiene un margen de error de 3 a 15 m según el equipo y la señal. Para el replanteo definitivo usar GPS de precisión.</p>
        </div>
      )}
    </div>
  );
}
