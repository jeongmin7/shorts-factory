import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { initializeApp } from '@/lib/init'
import './globals.css'

if (typeof window === 'undefined') {
  initializeApp()
}

export const metadata: Metadata = {
  title: 'Shorts Factory',
  description: 'YouTube Shorts 자동화 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
