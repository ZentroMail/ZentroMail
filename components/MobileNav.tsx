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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-white/10 px-4 py-3 flex items-center justify-around z-50">
      {navLinks.map((link) => {
        const isActive = pathname === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-1 min-w-[60px]"
          >
            <link.icon
              className={`w-5 h-5 ${
                isActive ? 'text-white' : 'text-gray-500'
              }`}
            />

            <span
              className={`text-[11px] ${
                isActive
                  ? 'text-white font-semibold'
                  : 'text-gray-500'
              }`}
            >
              {link.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
