'use client'

import { renamePlaylist, deletePlaylist } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { Edit2, Trash2 } from 'lucide-react'

export default function PlaylistActions({ playlistId, currentName }: { playlistId: string, currentName: string }) {
  const router = useRouter()

  const handleRename = async () => {
    const newName = prompt('Enter new playlist name:', currentName)
    if (newName && newName !== currentName) {
      await renamePlaylist(playlistId, newName)
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this playlist?')) {
      await deletePlaylist(playlistId)
      router.push('/')
    }
  }

  return (
    <div className="flex items-center gap-4 border-b border-white/10 pb-6 max-w-4xl">
      <button onClick={handleRename} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-semibold text-sm bg-white/5 px-4 py-2 rounded-full">
        <Edit2 className="w-4 h-4" /> Rename
      </button>
      <button onClick={handleDelete} className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors font-semibold text-sm bg-white/5 px-4 py-2 rounded-full">
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  )
}
