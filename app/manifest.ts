import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'One',
    short_name: 'One',
    description: 'Viața ta. Organizată simplu.',
    lang: 'ro',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#08111f',
    theme_color: '#08111f',
    icons: [
      { src: '/icons/one-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/one-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
