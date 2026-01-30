yesd
  'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChatMessage {
  id: number
  username: string
  message: string
  timestamp: string
  pfp_url: string
  created_at: string
}

interface ChatPopupProps {
  isOpen: boolean
  onClose: () => void
  username: string
  pfpUrl?: string
  onSendMessage: (message: string) => void
  messages: ChatMessage[]
}

export function ChatPopup({ isOpen, onClose, username, pfpUrl = '', onSendMessage, messages }: ChatPopupProps) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      // Use RAF to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
      })
    }
  }, [messages.length])

  const handleSend = () => {
    if (inputMessage.trim().length === 0) return
    
    try {
      onSendMessage(inputMessage.trim())
      setInputMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now'
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    // More than 24 hours
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96 bg-black/95 border-2 border-purple-500/50 rounded-lg shadow-2xl flex flex-col" style={{ height: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-purple-500/30 bg-purple-900/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-white">Global Chat</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-8 w-8 p-0 hover:bg-purple-500/20"
        >
          <X className="w-4 h-4 text-white" />
        </Button>
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet. Be the first to chat!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 animate-in fade-in duration-300">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {msg.pfp_url ? (
                    <img
                      src={msg.pfp_url}
                      alt={msg.username}
                      className="w-8 h-8 rounded-full border border-purple-500/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold border border-purple-500/50">
                      {msg.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-purple-300 text-sm">{msg.username}</span>
                    <span className="text-xs text-gray-500">{formatTimestamp(msg.created_at)}</span>
                  </div>
                  <p className="text-white text-sm break-words mt-0.5">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          {/* Dummy element for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-purple-500/30 bg-purple-900/10">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-black/50 border-purple-500/50 text-white placeholder-gray-400 focus:border-purple-400"
            maxLength={200}
          />
          <Button
            onClick={handleSend}
            disabled={inputMessage.trim().length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {inputMessage.length}/200 characters
        </p>
      </div>
    </div>
  )
}

// Floating Chat Button Component
interface FloatingChatButtonProps {
  onClick: () => void
  unreadCount?: number
}

export function FloatingChatButton({ onClick, unreadCount = 0 }: FloatingChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 border-2 border-purple-400"
      aria-label="Open chat"
    >
      <MessageCircle className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
