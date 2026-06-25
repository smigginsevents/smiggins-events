import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Login page lives inside this layout segment — render it without host chrome.
  // The proxy.ts middleware already redirects unauthenticated users away from
  // all other /host/** routes, so we don't need to redirect here too.
  if (!user) return <>{children}</>

  return (
    <div className="min-h-screen flex flex-col bg-snow">
      <header className="bg-navy text-white px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link href="/host" className="font-display text-xl tracking-wide">
            SMIGGINS <span className="text-timber">HOST</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link href="/host/trivia/new" className="text-white/70 hover:text-white transition-colors">
              + Trivia
            </Link>
            <Link href="/host/pool/new" className="text-white/70 hover:text-white transition-colors">
              + Pool
            </Link>
            <Link href="/host/teams" className="text-white/70 hover:text-white transition-colors">
              Teams
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Public site
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 py-8 px-6">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
