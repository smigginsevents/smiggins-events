import type { Metadata } from 'next'
import { Inter, Bebas_Neue, Jost, Playball } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  variable: '--font-bebas',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

const playball = Playball({
  variable: '--font-dancing',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Smiggins Events',
  description: 'Tuesday Trivia Night & Monday Pool Comp at Smiggins Hotel',
  openGraph: {
    title: 'Smiggins Events',
    description: 'Tuesday Trivia Night & Monday Pool Comp at Smiggins Hotel',
    siteName: 'Smiggins Events',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bebasNeue.variable} ${jost.variable} ${playball.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
