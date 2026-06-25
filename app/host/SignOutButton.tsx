'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/host/login')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="text-white/40 hover:text-white/70 text-xs transition-colors"
    >
      Sign out
    </button>
  )
}
