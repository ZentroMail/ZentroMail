'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { usePlayerStore } from '@/lib/store';

export default function Player() {
  const { currentTrack, isPlaying, setIsPlaying } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Autoplay blocked:", error);
            setIsPlaying(false);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [currentTrack, isPlaying, setIsPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - bounds.left) / bounds.width;
      audioRef.current.currentTime = percent * audioRef.current.duration;
      setProgress(percent * 100);
    }
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#181818] border-t border-white/10 px-4 md:px-6 flex items-center justify-between z-50">
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-3 md:gap-4 w-1/3">
        <img src={currentTrack.coverUrl} alt="Cover" className="h-12 w-12 md:h-14 md:w-14 rounded-md object-cover shadow-lg" loading="lazy" />
        <div className="flex flex-col overflow-hidden">
          <span className="text-white font-bold text-xs md:text-sm tracking-wide truncate">{currentTrack.title}</span>
          <span className="text-gray-400 text-[10px] md:text-xs truncate">{currentTrack.artist}</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-1/3 gap-2">
        <div className="flex items-center gap-4 md:gap-6">
          <SkipBack className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white cursor-pointer" />
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 text-black" /> : <Play className="w-4 h-4 md:w-5 md:h-5 text-black ml-1" />}
          </button>
          <SkipForward className="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white cursor-pointer" />
        </div>
        
        <div className="w-full max-w-md items-center gap-2 hidden md:flex">
          <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden cursor-pointer group" onClick={handleSeek}>
            <div className="h-full bg-white group-hover:bg-coral-500 transition-colors" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="items-center justify-end w-1/3 gap-3 hidden md:flex">
        <Volume2 className="w-5 h-5 text-gray-400" />
        <div className="w-24 h-1.5 bg-white/20 rounded-full cursor-pointer group">
          <div className="w-full h-full bg-white group-hover:bg-coral-500 rounded-full" />
        </div>
      </div>
    </div>
  );
}
