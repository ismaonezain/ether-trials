import type { Metadata, Viewport } from 'next'
import '@coinbase/onchainkit/styles.css';
import './globals.css';
import { Providers } from './providers';
import FarcasterWrapper from "@/components/FarcasterWrapper";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <FarcasterWrapper>
            {children}
          </FarcasterWrapper>
        </Providers>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
        title: "Ether Trials",
        description: "A fast-paced auto-battle RPG built entirely with 2D sprite animation.\r\nPlayers choose one of five anime-style heroes — Knight, Mage, Warrior, Assassin, or Archer — each with fixed cooldowns and unique skills.\r\nGameplay runs in portrait mode, optimized for single-hand use.",
        other: { "fc:frame": JSON.stringify({"version":"next","imageUrl":"https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/thumbnail_cmha1j5am000004l44dmg6u37-aDLOi4S6iFDm0acfdx1TbfQs6fGUdJ","button":{"title":"Open with Ohara","action":{"type":"launch_frame","name":"Ether Trials","url":"https://bat-been-379.app.ohara.ai","splashImageUrl":"https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/farcaster/splash_images/splash_image1.svg","splashBackgroundColor":"#ffffff"}}}
        ) }
    };
