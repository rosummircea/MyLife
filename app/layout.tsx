import type { Metadata, Viewport } from 'next'
import './globals.css'
import './connected.css'

export const metadata: Metadata = {
  title: 'MyLife',
  description: 'Viața ta. Organizată simplu.',
  applicationName: 'MyLife',
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
