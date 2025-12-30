'use client'

import { useState, useEffect } from 'react'

interface ChatMessage {
  messageId: bigint
  username: string
  message: string
  timestamp: bigint
  pfpUrl: string
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [lastMessageCount, setLastMessageCount] = useState(0)

  // Calculate unread count
  const unreadCount = messages.length > lastMessageCount ? messages.length - lastMessageCount : 0

  const markAsRead = () => {
    setLastMessageCount(messages.length)
  }

  return {
    messages,
    setMessages,
    unreadCount,
    markAsRead,
  }
}
