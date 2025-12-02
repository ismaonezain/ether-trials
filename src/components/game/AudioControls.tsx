'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, Music, Music2 } from 'lucide-react';
import { 
  setMuted, 
  isSoundMuted, 
  setMusicMuted, 
  isMusicMuted,
  setSfxVolume,
  getSfxVolume,
  setMusicVolume,
  getMusicVolume
} from '@/lib/game/soundEffects';

interface AudioControlsProps {
  compact?: boolean;
}

export function AudioControls({ compact = false }: AudioControlsProps): JSX.Element {
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [sfxVol, setSfxVol] = useState<number>(25); // 25% default
  const [musicVol, setMusicVol] = useState<number>(50); // 50% default

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSfx = localStorage.getItem('sfxEnabled');
      const savedMusic = localStorage.getItem('musicEnabled');
      const savedSfxVol = localStorage.getItem('sfxVolume');
      const savedMusicVol = localStorage.getItem('musicVolume');
      
      if (savedSfx !== null) {
        const sfxState = savedSfx === 'true';
        setSfxEnabled(sfxState);
        setMuted(!sfxState);
      }
      
      if (savedMusic !== null) {
        const musicState = savedMusic === 'true';
        setMusicEnabled(musicState);
        setMusicMuted(!musicState);
      }

      if (savedSfxVol !== null) {
        const vol = parseInt(savedSfxVol, 10);
        setSfxVol(vol);
        setSfxVolume(vol / 100);
      }

      if (savedMusicVol !== null) {
        const vol = parseInt(savedMusicVol, 10);
        setMusicVol(vol);
        setMusicVolume(vol / 100);
      }
    }
  }, []);

  const toggleSfx = (): void => {
    const newState = !sfxEnabled;
    setSfxEnabled(newState);
    setMuted(!newState);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('sfxEnabled', String(newState));
    }
  };

  const toggleMusic = (): void => {
    const newState = !musicEnabled;
    setMusicEnabled(newState);
    setMusicMuted(!newState);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('musicEnabled', String(newState));
    }
  };

  const handleSfxVolumeChange = (value: number[]): void => {
    const vol = value[0];
    setSfxVol(vol);
    setSfxVolume(vol / 100);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('sfxVolume', String(vol));
    }
  };

  const handleMusicVolumeChange = (value: number[]): void => {
    const vol = value[0];
    setMusicVol(vol);
    setMusicVolume(vol / 100);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('musicVolume', String(vol));
    }
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={toggleMusic}
          className={`${
            musicEnabled 
              ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/50 bg-black/30' 
              : 'border-gray-600 text-gray-400 hover:bg-gray-900/50 bg-black/50'
          } transition-all`}
          title={musicEnabled ? 'Music: ON' : 'Music: OFF'}
        >
          {musicEnabled ? <Music className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={toggleSfx}
          className={`${
            sfxEnabled 
              ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/50 bg-black/30' 
              : 'border-gray-600 text-gray-400 hover:bg-gray-900/50 bg-black/50'
          } transition-all`}
          title={sfxEnabled ? 'SFX: ON' : 'SFX: OFF'}
        >
          {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Music Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleMusic}
            className={`${
              musicEnabled 
                ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/50 bg-black/30' 
                : 'border-gray-600 text-gray-400 hover:bg-gray-900/50 bg-black/50'
            } transition-all font-bold`}
          >
            {musicEnabled ? <Music className="h-4 w-4 mr-2" /> : <Music2 className="h-4 w-4 mr-2" />}
            Music {musicEnabled ? 'ON' : 'OFF'}
          </Button>
          <span className="text-xs text-gray-400">{musicVol}%</span>
        </div>
        {musicEnabled && (
          <Slider
            value={[musicVol]}
            onValueChange={handleMusicVolumeChange}
            max={100}
            step={5}
            className="w-full"
          />
        )}
      </div>

      {/* SFX Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleSfx}
            className={`${
              sfxEnabled 
                ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/50 bg-black/30' 
                : 'border-gray-600 text-gray-400 hover:bg-gray-900/50 bg-black/50'
            } transition-all font-bold`}
          >
            {sfxEnabled ? <Volume2 className="h-4 w-4 mr-2" /> : <VolumeX className="h-4 w-4 mr-2" />}
            SFX {sfxEnabled ? 'ON' : 'OFF'}
          </Button>
          <span className="text-xs text-gray-400">{sfxVol}%</span>
        </div>
        {sfxEnabled && (
          <Slider
            value={[sfxVol]}
            onValueChange={handleSfxVolumeChange}
            max={100}
            step={5}
            className="w-full"
          />
        )}
      </div>
    </div>
  );
}
