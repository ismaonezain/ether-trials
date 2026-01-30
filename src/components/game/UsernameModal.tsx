kono
  'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UsernameModalProps {
  onSubmit: (username: string) => void;
}

export function UsernameModal({ onSubmit }: UsernameModalProps): JSX.Element {
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (): void => {
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      setError('Username can only contain letters, numbers, underscore, and dash');
      return;
    }
    
    onSubmit(trimmed);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-white">
            Choose Your Username
          </CardTitle>
          <p className="text-center text-gray-400 text-sm mt-2">
            Your username will appear on the leaderboard
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Username Input */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              maxLength={20}
              className="bg-gray-800 border-gray-700 text-white"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}
          </div>

          {/* Requirements */}
          <div className="bg-gray-800 p-3 rounded space-y-1 text-xs text-gray-400">
            <p>✓ 3-20 characters</p>
            <p>✓ Letters, numbers, underscore, and dash only</p>
            <p>✓ Will be stored decentrally on SpacetimeDB</p>
          </div>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full text-lg font-bold"
            onClick={handleSubmit}
            disabled={username.trim().length < 3}
          >
            Continue
          </Button>

          {/* Info */}
          <p className="text-center text-gray-500 text-xs">
            🏆 Show your name with pride on the leaderboard!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
