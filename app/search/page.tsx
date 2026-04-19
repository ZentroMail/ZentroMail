import prisma from '@/lib/prisma';
import { Search as SearchIcon } from 'lucide-react';
import TrackCard from '@/components/TrackCard';
import { createClient } from '@/utils/supabase/server';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  
  let tracks: any[] = [];
  if (query) {
    tracks = await prisma.track.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { artist: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let likedTrackIds = new Set<string>();
  if (user) {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: { likedTracks: { select: { id: true } } }
    });
    likedTrackIds = new Set(userData?.likedTracks.map(t => t.id) || []);
  }

  return (
    <div className="p-4 md:p-8 bg-[#121212] min-h-screen pt-10 md:pt-8">
      <div className="mb-8 relative max-w-xl">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-black" />
        <form action="/search" method="GET">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="What do you want to listen to?"
            className="w-full py-4 pl-14 pr-6 rounded-full bg-white text-black text-lg font-semibold placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-white/20 transition-all"
          />
        </form>
      </div>

      {query && (
        <div>
          <h3 className="text-2xl font-bold text-white mb-6">Top Results</h3>
          {tracks.length > 0 ? (
            <div className="flex flex-col gap-2 max-w-4xl">
              {tracks.map((track) => (
                <TrackCard 
                  key={track.id} 
                  track={track} 
                  isLikedInitial={likedTrackIds.has(track.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-20 text-center">
              <p className="text-2xl font-bold text-white mb-2">No results found for "{query}"</p>
              <p className="text-gray-400">Please make sure your words are spelled correctly.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
