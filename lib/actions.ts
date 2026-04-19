'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function toggleLike(trackId: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    include: { likedTracks: { where: { id: trackId } } }
  })

  const hasLiked = existing?.likedTracks.length && existing.likedTracks.length > 0

  if (hasLiked) {
    await prisma.user.update({
      where: { id: user.id },
      data: { likedTracks: { disconnect: { id: trackId } } }
    })
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { likedTracks: { connect: { id: trackId } } }
    })
  }
  revalidatePath('/liked')
  revalidatePath('/')
}

export async function recordHistory(trackId: string) {
  const user = await getUser()
  if (!user) return

  await prisma.history.create({
    data: {
      userId: user.id,
      trackId: trackId,
    }
  })
  revalidatePath('/history')
}

export async function createPlaylist(name: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const playlist = await prisma.playlist.create({
    data: {
      name,
      userId: user.id
    }
  })
  revalidatePath('/')
  return playlist.id
}

export async function deletePlaylist(playlistId: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  await prisma.playlist.delete({
    where: { id: playlistId, userId: user.id }
  })
  revalidatePath('/')
}

export async function renamePlaylist(playlistId: string, name: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  await prisma.playlist.update({
    where: { id: playlistId, userId: user.id },
    data: { name }
  })
  revalidatePath(`/playlists/${playlistId}`)
}

export async function addTrackToPlaylist(playlistId: string, trackId: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  await prisma.playlist.update({
    where: { id: playlistId, userId: user.id },
    data: { tracks: { connect: { id: trackId } } }
  })
  revalidatePath(`/playlists/${playlistId}`)
}

export async function getUserPlaylists() {
  const user = await getUser()
  if (!user) return []
  return await prisma.playlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  })
}
