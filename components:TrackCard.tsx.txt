'use client'

import { Play, Heart, Plus } from 'lucide-react'
import { usePlayerStore, type Track } from '@/lib/store'
import { toggleLike, recordHistory, getUserPlaylists, addTrackToPlaylist } from '@/lib/actions'
import { useState } from 'react'

export default function TrackCard({ 
  track, 
  isLikedInitial = false,
}: { 
  track: Track, 
  isLikedInitial?: boolean,
}) {
  const { setCurrentTrack, currentTrack, isPlaying, setIsPlaying } = usePlayerStore()
  const [isLiked, setIsLiked] = useState(isLikedInitial)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [playlists, setPlaylists] = useState<{id: string, name: string}[]>([])

  const isCurrentlyPlaying = currentTrack?.id === track.id

  const handlePlay = async () => {
    if (isCurrentlyPlaying) {
      setIsPlaying(!isPlaying)
    } else {
      setCurrentTrack(track)
      await recordHistory(track.id)
    }
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLiked(!isLiked)
    await toggleLike(track.id)
  }

  const handleShowPlaylists = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const lists = await getUserPlaylists()
    setPlaylists(lists)
    setShowPlaylists(true)
  }

  const handleAddToPlaylist = async (e: React.MouseEvent, pId: string) => {
    e.stopPropagation()
    await addTrackToPlaylist(pId, track.id)
    setShowPlaylists(false)
  }

  return (
    <div className="group flex items-center bg-white/5 hover:bg-white/10 rounded-md p-2 transition-colors cursor-pointer relative w-full">
      <div onClick={handlePlay} className="flex flex-1 items-center gap-4 overflow-hidden">
        <div className="relative">
          <img src={track.coverUrl} alt={track.title} className="w-12 h-12 md:w-16 md:h-16 object-cover rounded shadow-md" loading="lazy" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-6 h-6 text-white fill-current ml-1" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold truncate ${isCurrentlyPlaying ? 'text-coral-500' : 'text-white'}`}>
            {track.title}
          </h4>
          <p className="text-sm text-gray-400 truncate">{track.artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 ml-4">
        <button onClick={handleLike} className="p-2 hover:scale-110 transition-transform">
          <Heart className={`w-5 h-5 ${isLiked ? 'text-coral-500 fill-current' : 'text-gray-400 hover:text-white'}`} />
        </button>
        
        <div className="relative">
          <button onClick={handleShowPlaylists} className="p-2 hover:scale-110 transition-transform text-gray-400 hover:text-white">
            <Plus className="w-5 h-5" />
          </button>
          
          {showPlaylists && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] border border-white/10 rounded-md shadow-xl z-50 py-2">
              <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/10 mb-1">
                Add to Playlist
              </div>
              {playlists.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-400">No playlists yet</div>
              ) : (
                playlists.map(p => (
                  <button 
                    key={p.id}
                    onClick={(e) => handleAddToPlaylist(e, p.id)}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 truncate"
                  >
                    {p.name}
                  </button>
                ))
              )}
              <div 
                className="px-4 py-2 text-sm text-coral-500 hover:bg-white/10 cursor-pointer border-t border-white/10 mt-1"
                onClick={(e) => { e.stopPropagation(); setShowPlaylists(false) }}
              >
                Cancel
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
