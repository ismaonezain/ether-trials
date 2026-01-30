kono
  'use client';

import { useState } from 'react';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, MessageSquare } from 'lucide-react';

interface FeedbackFormProps {
  onClose: () => void;
}

export function FeedbackForm({ onClose }: FeedbackFormProps): JSX.Element {
  const [feedback, setFeedback] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Get Farcaster profile for username
  const { profile } = useFarcasterProfile();

  const handleSubmit = async (): Promise<void> => {
    if (!feedback.trim() || sending) return;

    setSending(true);
    setError('');
    
    try {
      // Send feedback directly to Telegram
      const BOT_TOKEN = '';
      const CHAT_ID = '1520039504';
      
      // Get username from profile
      const username = profile?.username || profile?.displayName || `FID-${profile?.fid}` || 'Anonymous';
      
      const message = `🎮 <b>Ether Trials Feedback</b>\n\n<b>From:</b> @${username}\n\n<i>${feedback}</i>\n\n━━━━━━━━━━━━━━━━\n📱 Sent from Ether Trials Game`;
      
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol: 'https',
          origin: 'api.telegram.org',
          path: `/bot${BOT_TOKEN}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
          })
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.description || 'Failed to send feedback');
      }
      
      setSent(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setFeedback('');
        setSent(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to send feedback:', err);
      setError('Failed to send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full bg-gray-900 border-gray-700">
        <CardHeader className="pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-400" />
              <CardTitle className="text-2xl text-white">Send Feedback</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="text-sm text-gray-400 mt-2">
            💬 Share your thoughts, suggestions, or report bugs directly to the developer
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* Feedback Textarea */}
          <div>
            <label className="text-yellow-300 text-sm font-semibold mb-2 block">
              Your Feedback:
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think about Ether Trials! Bugs, suggestions, or just a friendly hello..."
              className="min-h-[150px] bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
              disabled={sending || sent}
              maxLength={500}
            />
            <div className="text-xs text-gray-400 mt-1">
              {feedback.length} / 500 characters
            </div>
          </div>

          {/* Success Message */}
          {sent && (
            <div className="bg-green-900/40 border border-green-500/50 rounded-lg p-3 text-center">
              <div className="text-green-400 font-semibold">✅ Feedback sent successfully!</div>
              <div className="text-green-300 text-xs mt-1">Your message has been delivered to Telegram.</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-3 text-center">
              <div className="text-red-400 font-semibold">❌ {error}</div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            onClick={handleSubmit}
            disabled={!feedback.trim() || sending || sent}
          >
            {sending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Sending...
              </>
            ) : sent ? (
              '✅ Sent!'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Feedback via Telegram
              </>
            )}
          </Button>

          {/* Info */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
            <div className="text-blue-300 text-xs space-y-1">
              <p>📱 Your feedback will be sent directly via Telegram</p>
              <p>🔐 No personal data is collected, only the message you write</p>
              <p>💙 Thank you for helping improve Ether Trials!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
