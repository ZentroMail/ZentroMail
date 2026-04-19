import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TrackCard from '@/components/TrackCard'
import { Heart } from 'lucide-react'

export default async function LikedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      likedTracks: true
    }
  })

  const tracks = userData?.likedTracks || []

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-b from-indigo-900/40 to-[#121212]">
      <div className="flex items-end gap-6 mb-10 pt-10">
        <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-coral-500 to-violet-600 rounded-lg shadow-2xl flex items-center justify-center">
          <Heart className="w-16 h-16 md:w-24 md:h-24 text-white fill-current" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-gray-300">Playlist</p>
          <h1 className="text-4xl md:text-7xl font-black text-white mt-2 mb-4">Liked Songs</h1>
          <p className="text-gray-400 font-medium">{tracks.length} songs</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-4xl">
        {tracks.length > 0 ? (
          tracks.map((track) => (
            <TrackCard key={track.id} track={track} isLikedInitial={true} />
          ))
        ) : (
          <p className="text-gray-400 mt-10 text-lg">Songs you like will appear here.</p>
        )}
      </div>
    </div>
  )
}
