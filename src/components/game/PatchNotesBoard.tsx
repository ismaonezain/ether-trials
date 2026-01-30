kon
  'use client';

import { useState } from 'react';
import { X, ScrollText, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Wrench, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PATCH_NOTES } from '@/data/patchNotes';
import type { PatchNote } from '@/data/patchNotes';

interface PatchNotesBoardProps {
  onClose: () => void;
}

export function PatchNotesBoard({ onClose }: PatchNotesBoardProps): JSX.Element {
  const [expandedVersion, setExpandedVersion] = useState<string>(PATCH_NOTES[0]?.version || '');

  const getCategoryIcon = (category: PatchNote['changes'][0]['category']): JSX.Element => {
    switch (category) {
      case 'buff':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'nerf':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'fix':
        return <Wrench className="w-4 h-4 text-blue-400" />;
      case 'new':
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      default:
        return <></>;
    }
  };

  const getCategoryBadgeColor = (category: PatchNote['changes'][0]['category']): string => {
    switch (category) {
      case 'buff':
        return 'bg-green-900/50 text-green-300 border-green-600';
      case 'nerf':
        return 'bg-red-900/50 text-red-300 border-red-600';
      case 'fix':
        return 'bg-blue-900/50 text-blue-300 border-blue-600';
      case 'new':
        return 'bg-yellow-900/50 text-yellow-300 border-yellow-600';
      default:
        return 'bg-gray-900/50 text-gray-300 border-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-gradient-to-br from-purple-950/95 to-black/95 border-2 border-yellow-500/50 shadow-2xl shadow-purple-500/50">
        <CardHeader className="border-b border-yellow-500/30 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <ScrollText className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-yellow-400">Patch Notes</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Balance Updates & Changes</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-white/10 rounded-full"
            >
              <X className="w-5 h-5 text-gray-300 hover:text-white" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-4">
            {PATCH_NOTES.map((patch) => {
              const isExpanded = expandedVersion === patch.version;

              return (
                <div
                  key={patch.version}
                  className="bg-gradient-to-br from-purple-900/40 to-black/40 rounded-lg border border-purple-600/30 overflow-hidden"
                >
                  {/* Version Header */}
                  <button
                    onClick={() => setExpandedVersion(isExpanded ? '' : patch.version)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-purple-600/30 text-purple-300 text-sm font-bold rounded-full border border-purple-500/50">
                        {patch.version}
                      </div>
                      <div className="text-gray-400 text-sm">{patch.date}</div>
                      <div className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-medium rounded border border-yellow-500/30">
                        {patch.changes.length} changes
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Changes List */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {patch.changes.map((change, index) => (
                        <div
                          key={index}
                          className="flex gap-3 p-3 bg-black/30 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors"
                        >
                          {/* Category Icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            {getCategoryIcon(change.category)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 text-xs font-bold uppercase rounded border ${getCategoryBadgeColor(change.category)}`}
                              >
                                {change.category}
                              </span>
                              <span
                                className="font-bold text-sm"
                                style={{ color: change.color }}
                              >
                                {change.target}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">
                              {change.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty State */}
            {PATCH_NOTES.length === 0 && (
              <div className="text-center py-12">
                <ScrollText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No patch notes available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
