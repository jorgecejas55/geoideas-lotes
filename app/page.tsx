'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface LoteItem { id: string; nombre: string; ubicacion: string; cliente: string; ha: number; ensayo: string; contorno: number[][]; ensayoPoly: number[][] }

function Silueta({ c, e }: { c: number[][]; e: number[][] }) {
  const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const w = (x1 - x0) * k, h = y1 - y0, s = 76 / Math.max(w, h);
  const ox = (84 - w * s) / 2, oy = (84 - h * s) / 2;
  const pt = (p: number[]) => `${(ox + (p[0] - x0) * k * s).toFixed(1)},${(oy + (y1 - p[1]) * s).toFixed(1)}`;
  return (
    <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
      <polygon points={c.map(pt).join(' ')} fill="#e3f0e3" stroke="#1a9850" strokeWidth="1.5" />
      <polygon points={e.map(pt).join(' ')} fill="#00e5ff55" stroke="#0a7c8c" strokeWidth="1.5" />
    </svg>
  );
}

export default function Home() {
  const [lotes, setLotes] = useState<LoteItem[] | null>(null);
  useEffect(() => { fetch('/data/lotes.json').then((r) => r.json()).then(setLotes).catch(() => setLotes([])); }, []);
  return (
    <main className="home">
      <header className="top">
        <img src="/icons/logo.png" alt="GEO IDEAS" className="logo" />
        <div className="ttl"><b>Lotes y ensayos</b><span>Ambientes de aptitud · uso en campo</span></div>
      </header>
      <section className="cards">
        {!lotes && <p className="muted pad">Cargando lotes…</p>}
        {lotes?.map((l) => (
          <Link key={l.id} href={`/lote/${l.id}/`} className="lcard">
            <Silueta c={l.contorno} e={l.ensayoPoly} />
            <div className="linfo">
              <b>{l.nombre}</b>
              <span>{l.ubicacion}</span>
              <span className="muted">{String(l.ha).replace('.', ',')} ha · ensayo {l.ensayo}</span>
            </div>
            <span className="chev" aria-hidden="true">›</span>
          </Link>
        ))}
      </section>
      <p className="fine pad">Abrí cada lote una vez con señal para tenerlo disponible sin conexión.</p>
    </main>
  );
}
