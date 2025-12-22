'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Share2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatEther } from 'viem';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';

interface ShareSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalClaimed: bigint;
  periodsCount: number;
}

export function ShareSuccessModal({ 
  isOpen, 
  onClose, 
  totalClaimed,
  periodsCount 
}: ShareSuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const { profile } = useFarcasterProfile();

  // Format TRIA without decimals
  const triaAmount = Number(formatEther(totalClaimed));
  const triaFormatted = Math.floor(triaAmount).toLocaleString();
  
  // Get user profile info
  const pfpUrl = profile?.pfpUrl || '';
  const username = profile?.username || 'Anonymous';
  
  // Miniapp embed URL with TRIA share API
  const gameLink = 'https://bat-been-379.app.ohara.ai';
  const shareApiUrl = `${gameLink}/api/share/tria?tria=${triaAmount}&periods=${periodsCount}&pfp=${encodeURIComponent(pfpUrl)}&username=${encodeURIComponent(username)}`;
  
  // Share text for Farcaster
  const shareText = `🏆 Just claimed ${triaFormatted} TRIA from ${periodsCount} period${periodsCount > 1 ? 's' : ''} in Ether Trials!\n\n⚔️ Feeling good about this victory! Join me on Base! 🎮\n\nby @ismaone.farcaster.eth`;

  // Farcaster cast URL with miniapp embed
  const castText = encodeURIComponent(shareText);
  const embedUrl = encodeURIComponent(shareApiUrl);
  const farcasterShareUrl = `https://warpcast.com/~/compose?text=${castText}&embeds[]=${embedUrl}&channelKey=base&mentions[]=235940`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareToFarcaster = () => {
    window.open(farcasterShareUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-green-900 to-emerald-900 border-2 border-green-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-yellow-400">
            <Trophy className="w-6 h-6" />
            Rewards Claimed! 🎉
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Success Summary */}
          <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-orange-900/30">
            <CardContent className="p-4 text-center">
              <div className="text-4xl mb-2">💰</div>
              <p className="text-2xl font-bold text-yellow-400 mb-1">
                {formatEther(totalClaimed)} TRIA
              </p>
              <p className="text-sm text-gray-300">
                Claimed from {periodsCount} period{periodsCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Share Section */}
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-300">
              ⚔️ Share your victory with the community!
            </p>

            {/* Share Text Preview */}
            <Card className="border-purple-500/50 bg-purple-900/20">
              <CardContent className="p-3">
                <p className="text-xs text-gray-300 whitespace-pre-line mb-2">
                  {shareText}
                </p>
                <Button
                  onClick={handleCopyText}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-purple-500/50 hover:bg-purple-900/50"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Text
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Share to Farcaster Button */}
            <Button
              onClick={handleShareToFarcaster}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 font-bold text-sm py-5"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share to Farcaster
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>

            {/* Miniapp Embed Info */}
            <div className="text-center text-xs text-gray-400">
              <p>🖼️ Mini app embed will show your achievement with pfp</p>
              <p className="text-[10px] text-gray-500 mt-1">
                Beautiful share card with {triaFormatted} TRIA
              </p>
            </div>
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-900/50"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
