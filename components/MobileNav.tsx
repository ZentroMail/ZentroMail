'use client'

import Link from 'next/link'
import { Home, Search, Heart, Clock } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function MobileNav() {
  const pathname = usePathname()

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/history', icon: Clock, label: 'History' },
    { href: '/liked', icon: Heart, label: 'Liked' },
  ]

  return (
    <div className="md:hidden fixed bottom-24 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 px-6 py-3 flex items-center justify-between z-40">
      {navLinks.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link key={link.href} href={link.href} className="flex flex-col items-center gap-1">
            <link.icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
            <span className={`text-[10px] ${isActive ? 'text-white font-bold' : 'text-gray-500'}`}>
              {link.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
