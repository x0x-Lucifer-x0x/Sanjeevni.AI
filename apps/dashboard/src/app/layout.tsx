import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sanjeevani AI — Command Center',
  description: 'Emergency Response Command Center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  )
}