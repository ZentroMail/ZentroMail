import prisma from '@/lib/prisma'
import TrackCard from '@/components/TrackCard'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tracks = await prisma.track.findMany({ take: 20 })

  let likedTrackIds = new Set<string>()

  if (user) {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        likedTracks: {
          select: { id: true },
        },
      },
    })

    likedTrackIds = new Set(userData?.likedTracks.map((t) => t.id) || [])
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-900/40 via-[#121212] to-black text-white p-5 md:p-8 lg:ml-64 pb-28">
      <section className="mb-10 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-widest text-white/80 mb-2">
          Welcome to EMUSIC
        </p>

        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          Discover your next favorite song
        </h1>

        <p className="text-white/80 max-w-xl">
          Stream trending tracks, build playlists, and enjoy music anywhere.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold">Trending Now</h2>
          <span className="text-sm text-gray-400">{tracks.length} tracks</span>
        </div>

        <div className="space-y-3 max-w-5xl">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isLikedInitial={likedTrackIds.has(track.id)}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
