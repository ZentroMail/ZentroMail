import prisma from '@/lib/prisma';
import TrackCard from '@/components/TrackCard';
import { createClient } from '@/utils/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const tracks = await prisma.track.findMany({ take: 20 });
  
  let likedTrackIds = new Set<string>();
  if (user) {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: { likedTracks: { select: { id: true } } }
    });
    likedTrackIds = new Set(userData?.likedTracks.map(t => t.id) || []);
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-b from-violet-900/40 to-[#121212] min-h-screen">
      <header className="flex justify-between items-center mb-8 pt-6 md:pt-0">
        <h2 className="text-3xl font-bold text-white">Discover</h2>
      </header>

      <section className="mb-12">
        <h3 className="text-xl font-bold text-white mb-6">Trending Now</h3>
        <div className="flex flex-col gap-2 max-w-4xl">
          {tracks.map((track) => (
            <TrackCard 
              key={track.id} 
              track={track} 
              isLikedInitial={likedTrackIds.has(track.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
