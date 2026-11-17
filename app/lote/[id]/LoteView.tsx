'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LoteMeta } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function LoteView({ id }: { id: string }) {
  const [meta, setMeta] = useState<LoteMeta | null>(null);
  useEffect(() => { fetch(`/data/${id}/meta.json`).then((r) => r.json()).then(setMeta); }, [id]);
  return (
    <main className="app">
      <header className="top">
        <Link href="/" className="back" aria-label="Volver a los lotes">‹</Link>
        <img src="/icons/logo.png" alt="GEO IDEAS" className="logo" />
        <div className="ttl">
          <b>{meta?.nombre ?? 'Cargando…'}</b>
          {meta && <span>{meta.ubicacion} · {String(meta.ha).replace('.', ',')} ha</span>}
        </div>
      </header>
      {meta ? <MapView key={meta.id} meta={meta} /> : <div className="loading">Cargando lote…</div>}
    </main>
  );
}
