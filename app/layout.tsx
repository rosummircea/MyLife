import type { Metadata, Viewport } from 'next'
import './globals.css'
import './connected.css'
import './home-apple.css'

export const metadata: Metadata = {
  title: 'One',
  description: 'Viața ta. Organizată simplu.',
  applicationName: 'One',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'One', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/one-192-v2.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/one-apple-180-v2.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#08111f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  )
}
