'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
} from 'lucide-react'
import { usePlayerStore } from '@/lib/store'

export default function Player() {
  const { currentTrack, isPlaying, setIsPlaying } = usePlayerStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    if (isPlaying) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audioRef.current.pause()
    }
  }, [currentTrack, isPlaying, setIsPlaying])

  const handleTimeUpdate = () => {
    if (!audioRef.current?.duration) return

    setProgress(
      (audioRef.current.currentTime / audioRef.current.duration) * 100
    )
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current?.duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width

    audioRef.current.currentTime =
      percent * audioRef.current.duration

    setProgress(percent * 100)
  }

  if (!currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 z-50">
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 w-[40%]">
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className="w-12 h-12 rounded-lg object-cover"
          />

          <div className="min-w-0">
            <p className="text-sm text-white font-semibold truncate">
              {currentTrack.title}
            </p>

            <p className="text-xs text-gray-400 truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="flex items-center gap-5">
            <SkipBack className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" />

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              )}
            </button>

            <SkipForward className="w-4 h-4 text-gray-400 hover:text-white cursor-pointer" />
          </div>

          <div
            onClick={handleSeek}
            className="hidden md:block w-full max-w-md h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
          >
            <div
              className="h-full bg-pink-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 w-[20%] justify-end">
          <Volume2 className="w-4 h-4 text-gray-400" />

          <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-3/4 h-full bg-white" />
          </div>
        </div>
      </div>
    </div>
  )
}
