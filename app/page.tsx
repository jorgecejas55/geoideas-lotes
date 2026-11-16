'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { LoteMeta } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

interface LoteItem { id: string; nombre: string; ubicacion: string; cliente: string; ha: number }

export default function Home() {
  const [lotes, setLotes] = useState<LoteItem[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [meta, setMeta] = useState<LoteMeta | null>(null);

  useEffect(() => {
    fetch('/data/lotes.json').then((r) => r.json()).then((l: LoteItem[]) => {
      setLotes(l);
      const saved = typeof localStorage !== 'undefined' ? (() => { try { return localStorage.getItem('lote'); } catch { return null; } })() : null;
      setSel(l.find((x) => x.id === saved)?.id ?? l[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!sel) return;
    try { localStorage.setItem('lote', sel); } catch {}
    setMeta(null);
    fetch(`/data/${sel}/meta.json`).then((r) => r.json()).then(setMeta);
  }, [sel]);

  return (
    <main className="app">
      <header className="top">
        <img src="/icons/logo.png" alt="GEO IDEAS" className="logo" />
        <div className="ttl">
          {lotes.length > 1 ? (
            <select value={sel ?? ''} onChange={(e) => setSel(e.target.value)}>
              {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          ) : (
            <b>{meta?.nombre ?? 'Cargando…'}</b>
          )}
          {meta && <span>{meta.ubicacion} · {String(meta.ha).replace('.', ',')} ha</span>}
        </div>
      </header>
      {meta ? <MapView key={meta.id} meta={meta} /> : <div className="loading">Cargando lote…</div>}
    </main>
  );
}
