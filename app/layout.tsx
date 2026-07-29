import type { Metadata } from 'next'
import './globals.css'
import BottomTabBar from './components/BottomTabBar'
import Providers from './components/Providers'

export const metadata: Metadata = {
  title: 'RIV Margarita Premier',
  description: 'Sistema de Gestión Inmobiliaria Interna',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Escala correcta en móviles: no zoom automático en inputs de iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#800020" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-gray-100 min-h-screen font-inter antialiased">
        <Providers>
          {/* 
            max-w-md: limita a 448px en desktop (simulando pantalla móvil).
            En pantallas de teléfono reales, ocupa el 100% del ancho.
            min-h-[100dvh]: usa dynamic viewport height para evitar que la barra
            de Safari u otros browsers tape el contenido en iOS.
          */}
          <main className="max-w-md mx-auto relative bg-gray-50 min-h-[100dvh] shadow-sm overflow-x-hidden">
            {children}
            <BottomTabBar />
          </main>
        </Providers>
      </body>
    </html>
  )
}
