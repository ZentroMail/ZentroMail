import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TrackCard from '@/components/TrackCard'
import { Clock } from 'lucide-react'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const history = await prisma.history.findMany({
    where: { userId: user.id },
    include: { track: true },
    orderBy: { playedAt: 'desc' },
    take: 50
  })

  // Deduplicate consecutive plays for a cleaner UI
  const uniqueTracks = history.filter((v, i, a) => a.findIndex(t => (t.trackId === v.trackId)) === i).map(h => h.track);

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: { likedTracks: { select: { id: true } } }
  })
  const likedTrackIds = new Set(userData?.likedTracks.map(t => t.id) || [])

  return (
    <div className="p-4 md:p-8 min-h-screen bg-[#121212]">
      <div className="flex items-center gap-4 mb-8 pt-6">
        <Clock className="w-10 h-10 text-coral-500" />
        <h1 className="text-3xl md:text-5xl font-black text-white">Recently Played</h1>
      </div>

      <div className="flex flex-col gap-2 max-w-4xl">
        {uniqueTracks.length > 0 ? (
          uniqueTracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              isLikedInitial={likedTrackIds.has(track.id)} 
            />
          ))
        ) : (
          <p className="text-gray-400 mt-10 text-lg">Your listening history is empty.</p>
        )}
      </div>
    </div>
  )
}
