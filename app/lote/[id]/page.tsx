import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import LoteView from './LoteView';

export function generateStaticParams() {
  const lotes = JSON.parse(readFileSync(join(process.cwd(), 'public/data/lotes.json'), 'utf8')) as { id: string }[];
  return lotes.map((l) => ({ id: l.id }));
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoteView id={id} />;
}
