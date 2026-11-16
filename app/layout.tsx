import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import SWRegister from '@/components/SWRegister';

export const metadata: Metadata = {
  title: 'GEO IDEAS · Lotes',
  description: 'Ambientes de aptitud y ensayos recomendados con ubicación GPS y uso sin conexión.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'GEO Lotes', statusBarStyle: 'default' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#1563A8', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
