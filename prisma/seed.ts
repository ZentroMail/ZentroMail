import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.track.createMany({
    data: [
      {
        title: "Neon City Lights",
        artist: "Synthwave Alpha",
        coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration: "3:45"
      },
      {
        title: "Deep Focus Lo-Fi",
        artist: "Chill Master",
        coverUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        duration: "4:12"
      },
      {
        title: "Uplifting Acoustic",
        artist: "Sunny Days",
        coverUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&q=80",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        duration: "2:58"
      }
    ],
    skipDuplicates: true,
  });
  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
