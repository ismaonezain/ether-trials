// anjing
'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  bio?: string;
  platform: 'Farcaster' | 'Base App' | 'Unknown';
}

export function useFarcasterProfile() {
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        // Check if SDK is ready - safe check
        if (!sdk) {
          throw new Error('Farcaster SDK not available');
        }

        // Get current user context with shorter timeout
        const contextPromise = sdk.context;
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SDK context timeout')), 1500)
        );
        
        const context = await Promise.race([contextPromise, timeoutPromise]) as typeof sdk.context;
        
        if (!context || !context.user) {
          console.log('⚠️ User not authenticated in Farcaster - using fallback');
          throw new Error('User not authenticated in Farcaster');
        }

        // Extract user data
        const user = context.user;
        
        // Detect platform from client info
        let platform: 'Farcaster' | 'Base App' | 'Unknown' = 'Unknown';
        if (context.client) {
          const clientName = context.client.name?.toLowerCase() || '';
          const clientFid = context.client.clientFid;
          
          // Base App has specific clientFid (usually 238626 for Base Mini App)
          // or client name contains 'base'
          if (clientFid === 238626 || clientName.includes('base')) {
            platform = 'Base App';
          } else if (clientName.includes('warpcast') || clientName.includes('farcaster')) {
            platform = 'Farcaster';
          }
        }
        
        const profileData: FarcasterProfile = {
          fid: user.fid,
          username: user.username || `user-${user.fid}`,
          displayName: user.displayName || user.username || `User ${user.fid}`,
          pfpUrl: user.pfpUrl,
          bio: user.bio,
          platform
        };

        console.log('🔍 Platform detected:', platform);
        console.log('📱 Client info:', { name: context.client?.name, fid: context.client?.clientFid });
        console.log('✅ Farcaster profile loaded:', profileData);
        setProfile(profileData);
      } catch (err) {
        console.log('ℹ️ Not in Farcaster/Base App - using anonymous mode');
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
        setError(errorMessage);
        
        // Fallback profile for web browser access
        const fallbackProfile: FarcasterProfile = {
          fid: 0,
          username: 'anonymous',
          displayName: 'Anonymous Player',
          platform: 'Unknown'
        };
        setProfile(fallbackProfile);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    isAuthenticated: profile !== null && profile.fid > 0
  };
}
