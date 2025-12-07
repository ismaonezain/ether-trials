'use client';

import type React from 'react';
import { useState } from 'react';
import { X, Megaphone } from 'lucide-react';
import type { Announcement } from '@/spacetime_module_bindings';

interface AnnouncementBannerProps {
  announcements: Announcement[];
}

export function AnnouncementBanner({ announcements }: AnnouncementBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState<Set<bigint>>(new Set());

  // Safety check: ensure announcements is an array
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];

  // Debug logging
  console.log('📢 AnnouncementBanner render:', {
    totalAnnouncements: safeAnnouncements.length,
    announcements: safeAnnouncements.map(a => ({ id: a.announcementId.toString(), title: a.title }))
  });

  // Filter out dismissed announcements and show only the latest
  const visibleAnnouncements = safeAnnouncements.filter(a => !dismissed.has(a.announcementId));
  
  console.log('👁️ Visible announcements:', visibleAnnouncements.length);
  
  if (visibleAnnouncements.length === 0) {
    console.log('⚠️ No visible announcements to display');
    return null;
  }

  // Show only the latest announcement
  const latestAnnouncement = visibleAnnouncements[0];

  const handleDismiss = (): void => {
    setDismissed(prev => new Set(prev).add(latestAnnouncement.announcementId));
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-top-5 duration-300">
      <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md border-2 border-yellow-400 rounded-lg shadow-2xl shadow-purple-500/50">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-yellow-400" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-yellow-400 font-bold text-base">
                  {latestAnnouncement.title}
                </h3>
                {latestAnnouncement.postedToFarcaster && (
                  <span className="px-2 py-0.5 bg-purple-600/50 text-purple-200 text-xs font-medium rounded">
                    Posted to Farcaster
                  </span>
                )}
              </div>
              <p className="text-gray-200 text-sm leading-relaxed">
                {latestAnnouncement.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-5 h-5 text-gray-300 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
