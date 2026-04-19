'use client'

import { Play, Pause, Heart, Plus } from 'lucide-react'
import { usePlayerStore, type Track } from '@/lib/store'
import {
  toggleLike,
  recordHistory,
  getUserPlaylists,
  addTrackToPlaylist,
} from '@/lib/actions'
import { useState } from 'react'

export default function TrackCard({
  track,
  isLikedInitial = false,
}: {
  track: Track
  isLikedInitial?: boolean
}) {
  const { setCurrentTrack, currentTrack, isPlaying, setIsPlaying } =
    usePlayerStore()

  const [isLiked, setIsLiked] = useState(isLikedInitial)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([])

  const isCurrent = currentTrack?.id === track.id

  const handlePlay = async () => {
    if (isCurrent) {
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

  const handleAdd = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await addTrackToPlaylist(id, track.id)
    setShowPlaylists(false)
  }

  return (
    <div className="group relative flex items-center justify-between gap-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all p-3 md:p-4 border border-white/5">
      <div
        onClick={handlePlay}
        className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
      >
        <div className="relative shrink-0">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover"
          />

          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
            {isCurrent && isPlaying ? (
              <Pause className="w-5 h-5 text-white fill-current" />
            ) : (
              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h3
            className={`font-semibold truncate ${
              isCurrent ? 'text-pink-400' : 'text-white'
            }`}
          >
            {track.title}
          </h3>

          <p className="text-sm text-gray-400 truncate">{track.artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 relative">
        <button
          onClick={handleLike}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <Heart
            className={`w-5 h-5 ${
              isLiked
                ? 'text-pink-400 fill-current'
                : 'text-gray-400 hover:text-white'
            }`}
          />
        </button>

        <button
          onClick={handleShowPlaylists}
          className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
        >
          <Plus className="w-5 h-5" />
        </button>

        {showPlaylists && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-[#181818] border border-white/10 rounded-xl shadow-xl z-50 py-2">
            <div className="px-4 pb-2 text-xs uppercase text-gray-400 font-semibold">
              Add to Playlist
            </div>

            {playlists.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-400">
                No playlists yet
              </div>
            ) : (
              playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={(e) => handleAdd(e, p.id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 text-white truncate"
                >
                  {p.name}
                </button>
              ))
            )}

            <button
              onClick={() => setShowPlaylists(false)}
              className="w-full text-left px-4 py-2 text-sm text-pink-400 hover:bg-white/10 mt-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
