'use client'

import Link from 'next/link'
import { Home, Search, PlusCircle, Heart, LogOut, Clock } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { createPlaylist } from '@/lib/actions'

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleCreatePlaylist = async () => {
    const name = prompt('Enter playlist name:')
    if (name) {
      const id = await createPlaylist(name)
      router.push(`/playlists/${id}`)
    }
  }

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/history', icon: Clock, label: 'History' },
  ]

  return (
    <div className="hidden md:flex w-64 bg-black h-screen fixed left-0 top-0 text-gray-300 p-6 flex-col border-r border-white/10 z-40">
      <div className="mb-10 flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-tr from-coral-500 to-violet-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xl">E</span>
        </div>
        <h1 className="text-white font-bold text-2xl tracking-tight">EMUSIC</h1>
      </div>

      <nav className="flex flex-col gap-5 mb-10">
        {navLinks.map((link) => (
          <Link 
            key={link.href} 
            href={link.href} 
            className={`flex items-center gap-4 transition-colors font-semibold ${pathname === link.href ? 'text-white' : 'hover:text-white'}`}
          >
            <link.icon className="w-6 h-6" /> {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-4 mt-4 mb-auto">
        <button onClick={handleCreatePlaylist} className="flex items-center gap-4 hover:text-white transition-colors font-semibold">
          <PlusCircle className="w-6 h-6" /> Create Playlist
        </button>
        <Link href="/liked" className={`flex items-center gap-4 transition-colors font-semibold ${pathname === '/liked' ? 'text-white' : 'hover:text-white'}`}>
          <Heart className="w-6 h-6 text-coral-500" /> Liked Songs
        </Link>
      </div>

      <div className="border-t border-white/10 pt-6 mt-6 flex flex-col gap-4">
        <button onClick={handleLogout} className="flex items-center gap-4 text-gray-400 hover:text-white transition-colors text-sm font-semibold">
          <LogOut className="w-5 h-5" /> Log Out
        </button>
      </div>
    </div>
  )
}
