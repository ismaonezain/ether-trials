'use client';

import { useEffect, useRef } from 'react';
import { isMusicMuted, getMusicVolume } from '@/lib/game/soundEffects';

// Sequential playlist: New IPFS song first, then loop to old song
const LOBBY_MUSIC_URLS = [
  'https://gateway.lighthouse.storage/ipfs/bafybeia3v2m3dj6x2acq6nzt53vqft2t52ciatoqlalfr426s3uwypnnkq', // NEW: Lagu baru dari IPFS (plays first)
  'https://res.cloudinary.com/dgwnvjmws/video/upload/v1764087422/Everyday_Quest_1_pwqivo.mp3', // OLD: Everyday Quest 1
];
const BATTLE_MUSIC_URL = 'https://res.cloudinary.com/dgwnvjmws/video/upload/v1764088966/Until_the_Last_Breath_msrxbb.mp3';

interface LobbyMusicProps {
  isBattle?: boolean;
}

export function LobbyMusic({ isBattle = false }: LobbyMusicProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentMusicType = useRef<'lobby' | 'battle'>('lobby');
  const currentLobbyTrackIndex = useRef<number>(0); // Track current lobby song in playlist

  useEffect(() => {
    // Determine which music to play
    const musicUrl = isBattle ? BATTLE_MUSIC_URL : LOBBY_MUSIC_URLS[currentLobbyTrackIndex.current];
    const musicType = isBattle ? 'battle' : 'lobby';

    // If music type changed, switch audio
    if (currentMusicType.current !== musicType) {
      console.log(`🎵 Switching from ${currentMusicType.current} to ${musicType} music`);
      
      // Stop and clear old audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }

      // Create new audio with correct URL
      if (typeof window !== 'undefined') {
        const audio = new Audio(musicUrl);
        // NEW v5.0: Sequential playlist - don't loop individual tracks
        audio.loop = isBattle ? true : false; // Battle music loops, lobby music plays sequentially
        audio.volume = getMusicVolume();
        audioRef.current = audio;
        currentMusicType.current = musicType;
        
        // NEW v5.0: Sequential playlist - play next track when current ends
        if (!isBattle) {
          audio.addEventListener('ended', () => {
            console.log('🎵 Track ended, playing next in playlist...');
            currentLobbyTrackIndex.current = (currentLobbyTrackIndex.current + 1) % LOBBY_MUSIC_URLS.length;
            const nextTrackUrl = LOBBY_MUSIC_URLS[currentLobbyTrackIndex.current];
            audio.src = nextTrackUrl;
            audio.load();
            
            // Check mute state before playing next track
            const musicEnabled = localStorage.getItem('musicEnabled');
            const shouldPlay = musicEnabled === null || musicEnabled === 'true';
            if (shouldPlay) {
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                playPromise.catch((error: Error) => {
                  console.log('🎵 Next track autoplay failed:', error.message);
                });
              }
            }
          });
        }

        // Check mute state and play if enabled
        const musicEnabled = localStorage.getItem('musicEnabled');
        const shouldPlay = musicEnabled === null || musicEnabled === 'true';

        if (shouldPlay) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((error: Error) => {
              console.log('🎵 Music autoplay blocked:', error.message);
            });
          }
        }
      }
    }

    // Create audio element on first mount if not exists
    if (typeof window !== 'undefined' && !audioRef.current) {
      const audio = new Audio(musicUrl);
      // NEW v5.0: Sequential playlist - don't loop individual tracks
      audio.loop = isBattle ? true : false; // Battle music loops, lobby music plays sequentially
      audio.volume = getMusicVolume();
      audioRef.current = audio;
      currentMusicType.current = musicType;
      
      // NEW v5.0: Sequential playlist - play next track when current ends
      if (!isBattle) {
        audio.addEventListener('ended', () => {
          console.log('🎵 Track ended, playing next in playlist...');
          currentLobbyTrackIndex.current = (currentLobbyTrackIndex.current + 1) % LOBBY_MUSIC_URLS.length;
          const nextTrackUrl = LOBBY_MUSIC_URLS[currentLobbyTrackIndex.current];
          audio.src = nextTrackUrl;
          audio.load();
          
          // Check mute state before playing next track
          const musicEnabled = localStorage.getItem('musicEnabled');
          const shouldPlay = musicEnabled === null || musicEnabled === 'true';
          if (shouldPlay) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch((error: Error) => {
                console.log('🎵 Next track autoplay failed:', error.message);
              });
            }
          }
        });
      }

      const musicEnabled = localStorage.getItem('musicEnabled');
      const shouldPlay = musicEnabled === null || musicEnabled === 'true';

      if (shouldPlay) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error: Error) => {
            console.log('🎵 Music autoplay blocked:', error.message);
          });
        }
      }
    }

    // Check music mute state and volume periodically
    const checkInterval = setInterval(() => {
      if (audioRef.current) {
        const shouldBeMuted = isMusicMuted();
        const currentVolume = getMusicVolume();
        
        // Update volume
        if (audioRef.current.volume !== currentVolume) {
          audioRef.current.volume = currentVolume;
        }
        
        // Handle mute/unmute
        if (shouldBeMuted && !audioRef.current.paused) {
          audioRef.current.pause();
        } else if (!shouldBeMuted && audioRef.current.paused) {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((error: Error) => {
              console.log('🎵 Music play failed:', error.message);
            });
          }
        }
      }
    }, 500);

    return () => {
      clearInterval(checkInterval);
    };
  }, [isBattle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  return <></>;
}
