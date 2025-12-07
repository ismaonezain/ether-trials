'use client';

import { AdminPanelV3 } from './AdminPanelV3';

interface AdminModalV3Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminModalV3({ isOpen, onClose }: AdminModalV3Props): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-black border-2 border-purple-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/30 flex items-center justify-between bg-purple-900/50">
          <h2 className="text-2xl font-bold text-white">⚙️ Admin Panel V3</h2>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <AdminPanelV3 />
        </div>
      </div>
    </div>
  );
}
