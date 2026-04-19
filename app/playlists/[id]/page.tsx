import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TrackCard from '@/components/TrackCard'
import PlaylistActions from './PlaylistActions'

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const playlist = await prisma.playlist.findUnique({
    where: { id: id, userId: user.id },
    include: { tracks: true }
  })

  if (!playlist) redirect('/')

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    include: { likedTracks: { select: { id: true } } }
  })
  const likedTrackIds = new Set(userData?.likedTracks.map(t => t.id) || [])

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-b from-gray-800/40 to-[#121212]">
      <div className="flex items-end gap-6 mb-10 pt-10">
        <div className="w-32 h-32 md:w-48 md:h-48 bg-[#282828] rounded-lg shadow-2xl flex items-center justify-center border border-white/10">
          <span className="text-4xl md:text-6xl text-gray-500 font-bold">{playlist.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold uppercase tracking-widest text-gray-300">Playlist</p>
          <h1 className="text-4xl md:text-7xl font-black text-white mt-2 mb-4 truncate">{playlist.name}</h1>
          <p className="text-gray-400 font-medium">{playlist.tracks.length} songs</p>
        </div>
      </div>

      <PlaylistActions playlistId={playlist.id} currentName={playlist.name} />

      <div className="flex flex-col gap-2 max-w-4xl mt-8">
        {playlist.tracks.length > 0 ? (
          playlist.tracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              isLikedInitial={likedTrackIds.has(track.id)}
            />
          ))
        ) : (
          <div className="text-center mt-20">
            <p className="text-gray-400 text-lg">This playlist is empty.</p>
            <p className="text-gray-500 text-sm mt-2">Find songs in search and add them here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
