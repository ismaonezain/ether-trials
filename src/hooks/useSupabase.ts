'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js'
import { localFirstStore } from '@/lib/localFirstStore'

// Database types matching our schema
export interface GameRun {
  run_id: number
  identity: string
  username: string
  character_class: string
  score: number
  completion_time_seconds: number
  remaining_hp_percent: number
  total_worlds_completed: number
  timestamp: string
  is_paid_entry: boolean
  distribution_period: number
  wallet_address: string
  pfp_url: string
}

export interface PrizePool {
  pool_id: number
  total_pool_amount: number
  current_distribution_period: number
  last_distribution_timestamp: string
  next_distribution_timestamp: string
}

export interface PeriodRevenueSummary {
  period_number: number
  total_prize_pool_distributed: number
  total_platform_fees_collected: number
  total_revenue: number
  participants_count: number
  period_start: string
  period_end: string
}

export interface Announcement {
  announcement_id: number
  title: string
  message: string
  created_at: string
  posted_to_farcaster: boolean
}

export interface Entry {
  entry_id: number
  identity: string
  period: number
  fid: number
  username: string
  score: number
  stage: number
  remaining_hp_percent: number
  completion_time_seconds: number
  timestamp: string
  wallet_address: string
  class_name: string
  pfp_url: string
  entry_amount: number // in wei
}

export interface FunEntry {
  entry_id: number
  identity: string
  period: number
  fid: number
  username: string
  score: number
  stage: number
  remaining_hp_percent: number
  completion_time_seconds: number
  timestamp: string
  class_name: string
  pfp_url: string
}

export interface PrizeWinnings {
  identity: string
  username: string
  total_winnings: number
  last_reward_period: number
  wallet_address: string
}

export interface UserDiceUsage {
  id: number
  identity: string
  period: number
  rolls_used: number
  purchased_rolls: number
}

export interface ChatMessage {
  id: number
  username: string
  message: string
  timestamp: string
  pfp_url: string
  created_at: string
}

export function useSupabase() {
  const [connected, setConnected] = useState(false)
  const [identity, setIdentity] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('Connecting to database...')
  const [prizePool, setPrizePool] = useState<PrizePool | null>(null)
  const [periodRevenueSummary, setPeriodRevenueSummary] = useState<PeriodRevenueSummary[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [freeEntries, setFreeEntries] = useState<FunEntry[]>([])
  const [prizeWinnings, setPrizeWinnings] = useState<PrizeWinnings[]>([])
  const [userDiceUsage, setUserDiceUsage] = useState<UserDiceUsage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const channelsRef = useRef<RealtimeChannel[]>([])
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Initialize Supabase client with hardcoded credentials
    const supabaseUrl = 'https://inyeiolqczefkuwrpqyu.supabase.co'
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueWVpb2xxY3plZmt1d3JwcXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjQxMDUsImV4cCI6MjA3ODEwMDEwNX0.kwNM6FVZyusEPMmCqhhOeHb4Guhh2YDocbh6qJjkvoo'

    console.log('🔌 Connecting to Supabase...')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    supabaseRef.current = supabase

    // Register Supabase client with LocalFirstStore
    localFirstStore.setSupabase(supabase)

    // Generate a unique identity for this session (similar to SpacetimeDB)
    const sessionIdentity = `web_${Date.now()}_${Math.random().toString(36).substring(7)}`
    setIdentity(sessionIdentity)
    setConnected(true)
    setStatusMessage('Connected')
    console.log('✅ Connected to Supabase!')
    console.log('🆔 Session Identity:', sessionIdentity)
    console.log('🏪 Local-First mode enabled: data will save locally first, then sync in background')

    // Load initial data
    const loadInitialData = async () => {
      try {
        // Load prize pool
        const { data: poolData, error: poolError } = await supabase
          .from('prize_pool')
          .select('*')
          .eq('pool_id', 1)
          .single()
        
        if (poolError) throw poolError
        if (poolData) {
          console.log('💰 Prize pool loaded:', poolData.total_pool_amount, 'ETH')
          setPrizePool(poolData)
        }

        // Load period revenue summary
        const { data: summaryData, error: summaryError } = await supabase
          .from('period_revenue_summary')
          .select('*')
          .order('period_number', { ascending: false })
        
        if (summaryError) throw summaryError
        console.log('💵 Period revenue summary loaded:', summaryData?.length || 0, 'entries')
        setPeriodRevenueSummary(summaryData || [])

        // Load announcements
        const { data: announcementData, error: announcementError } = await supabase
          .from('announcement')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (announcementError) throw announcementError
        console.log('📢 Announcements loaded:', announcementData?.length || 0, 'entries')
        setAnnouncements(announcementData || [])

        // Load paid entries
        const { data: entryData, error: entryError } = await supabase
          .from('entry')
          .select('*')
          .order('score', { ascending: false })
        
        if (entryError) throw entryError
        console.log('🎯 Paid entries loaded:', entryData?.length || 0, 'entries')
        setEntries(entryData || [])

        // Load fun entries
        const { data: funEntryData, error: funEntryError } = await supabase
          .from('fun_entry')
          .select('*')
          .order('score', { ascending: false })
        
        if (funEntryError) throw funEntryError
        console.log('🎮 Fun entries loaded:', funEntryData?.length || 0, 'entries')
        setFreeEntries(funEntryData || [])

        // Load prize winnings
        const { data: winningsData, error: winningsError } = await supabase
          .from('prize_winnings')
          .select('*')
          .order('total_winnings', { ascending: false })
        
        if (winningsError) throw winningsError
        console.log('💰 Prize winnings loaded:', winningsData?.length || 0, 'entries')
        setPrizeWinnings(winningsData || [])

        // Load user dice usage
        const { data: diceData, error: diceError } = await supabase
          .from('user_dice_usage')
          .select('*')
        
        if (diceError) throw diceError
        console.log('🎲 User dice usage loaded:', diceData?.length || 0, 'entries')
        setUserDiceUsage(diceData || [])

        // Load chat messages (last 50)
        const { data: chatData, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (chatError && chatError.code !== 'PGRST116') {
          console.error('❌ Error loading chat messages:', chatError)
        } else {
          console.log('💬 Chat messages loaded:', chatData?.length || 0, 'messages')
          // Reverse to show oldest first
          setChatMessages(chatData ? chatData.reverse() : [])
        }

      } catch (error) {
        console.error('❌ Error loading initial data:', error)
      }
    }

    loadInitialData()

    // Setup real-time subscription for chat messages
    const chatChannel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          console.log('💬 New chat message received:', payload.new)
          const newMessage = payload.new as ChatMessage
          
          // Deduplication check - prevent double messages
          setChatMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id)
            if (exists) {
              console.log('🔄 Duplicate message detected, skipping:', newMessage.id)
              return prev
            }
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    channelsRef.current.push(chatChannel)
    console.log('✅ Real-time chat subscription active!')

    // ========================================
    // OPTIMIZED: Real-time subscriptions instead of polling
    // This drastically reduces egress by only receiving actual changes
    // ========================================
    console.log('🔔 Setting up real-time subscriptions (ZERO polling overhead)...')

    // Subscribe to prize pool updates
    const prizePoolChannel = supabase
      .channel('prize-pool-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'prize_pool',
          filter: 'pool_id=eq.1'
        },
        (payload) => {
          console.log('💰 Prize Pool updated via realtime:', payload.new)
          if (payload.new) {
            setPrizePool(payload.new as PrizePool)
          }
        }
      )
      .subscribe()

    channelsRef.current.push(prizePoolChannel)

    // Subscribe to paid entries (INSERT and UPDATE only)
    const entryChannel = supabase
      .channel('entry-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entry'
        },
        (payload) => {
          console.log('🎯 New paid entry via realtime:', payload.new)
          const newEntry = payload.new as Entry
          setEntries(prev => {
            // Deduplication
            const exists = prev.some(e => e.entry_id === newEntry.entry_id)
            if (exists) return prev
            // Insert and re-sort by score
            return [...prev, newEntry].sort((a, b) => b.score - a.score)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entry'
        },
        (payload) => {
          console.log('🔄 Paid entry updated via realtime:', payload.new)
          const updatedEntry = payload.new as Entry
          setEntries(prev => 
            prev.map(e => e.entry_id === updatedEntry.entry_id ? updatedEntry : e)
              .sort((a, b) => b.score - a.score)
          )
        }
      )
      .subscribe()

    channelsRef.current.push(entryChannel)

    // Subscribe to fun entries (INSERT and UPDATE only)
    const funEntryChannel = supabase
      .channel('fun-entry-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fun_entry'
        },
        (payload) => {
          console.log('🎮 New fun entry via realtime:', payload.new)
          const newEntry = payload.new as FunEntry
          setFreeEntries(prev => {
            // Deduplication
            const exists = prev.some(e => e.entry_id === newEntry.entry_id)
            if (exists) return prev
            // Insert and re-sort by score
            return [...prev, newEntry].sort((a, b) => b.score - a.score)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fun_entry'
        },
        (payload) => {
          console.log('🔄 Fun entry updated via realtime:', payload.new)
          const updatedEntry = payload.new as FunEntry
          setFreeEntries(prev => 
            prev.map(e => e.entry_id === updatedEntry.entry_id ? updatedEntry : e)
              .sort((a, b) => b.score - a.score)
          )
        }
      )
      .subscribe()

    channelsRef.current.push(funEntryChannel)

    // Subscribe to announcements
    const announcementChannel = supabase
      .channel('announcement-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcement'
        },
        (payload) => {
          console.log('📢 New announcement via realtime:', payload.new)
          const newAnnouncement = payload.new as Announcement
          setAnnouncements(prev => [newAnnouncement, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'announcement'
        },
        (payload) => {
          console.log('🗑️ Announcement deleted via realtime:', payload.old)
          const deletedId = (payload.old as Announcement).announcement_id
          setAnnouncements(prev => prev.filter(a => a.announcement_id !== deletedId))
        }
      )
      .subscribe()

    channelsRef.current.push(announcementChannel)

    console.log('✅ Real-time subscriptions active! (Prize Pool, Entries, Fun Entries, Announcements)')
    console.log('🚀 OPTIMIZATION: Removed 3s/5s/10s polling - now using push-based updates only!')

    // Monitor health status and pending sync count (optimized: 10s instead of 2s)
    const statusMonitorInterval = setInterval(() => {
      const health = localFirstStore.getHealthStatus()
      setIsOnline(health.isHealthy)
      setPendingSyncCount(localFirstStore.getPendingOperationsCount())
      
      if (!health.isHealthy && health.consecutiveFailures >= 3) {
        setStatusMessage('Offline Mode - Data saved locally')
      } else if (pendingSyncCount > 0) {
        setStatusMessage(`Syncing ${pendingSyncCount} operations...`)
      } else {
        setStatusMessage('Connected')
      }
    }, 10000) // OPTIMIZED: Check every 10 seconds instead of 2 seconds (reduces overhead by 80%)

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up real-time subscriptions and status monitor...')
      clearInterval(statusMonitorInterval)
      
      // Unsubscribe from all channels
      channelsRef.current.forEach(channel => {
        channel.unsubscribe()
      })
      channelsRef.current = []
      
      // Cleanup local-first store
      localFirstStore.cleanup()
    }
  }, [])

  // Start game run (free or paid) - LOCAL-FIRST VERSION
  const startGameRun = async (
    username: string,
    characterClass: string,
    paidEntryAmount: number,
    walletAddress: string,
    pfpUrl?: string,
    period?: number,
    build?: string,
    fid?: number,
    entryAmountWei?: number
  ) => {
    if (!identity) {
      throw new Error('No identity generated')
    }

    if (!username || username.trim().length === 0) {
      throw new Error('Username is required')
    }

    const cleanUsername = username.trim()

    try {
      console.log('💾 LOCAL-FIRST: Saving game run locally first...')
      
      // LOCAL-FIRST: Save to localStorage immediately (instant, never fails!)
      await localFirstStore.saveGameRun({
        identity,
        username: cleanUsername,
        characterClass,
        isPaidEntry: paidEntryAmount > 0,
        walletAddress,
        pfpUrl,
        period,
        fid,
        build,
        entryAmountWei
      })

      console.log('✅ Game run saved locally! Syncing to Supabase in background...')
    } catch (error) {
      console.error('❌ Failed to save game run locally:', error)
      throw error
    }
  }

  // Submit run result - LOCAL-FIRST VERSION
  const submitRunResult = async (
    score: number,
    completionTime: number,
    remainingHp: number,
    worldsCompleted: number
  ) => {
    if (!identity) {
      return Promise.reject(new Error('No identity generated'))
    }

    try {
      console.log('💾 LOCAL-FIRST: Saving score locally first...')
      console.log('📊 Score data:', { score, completionTime, remainingHp, worldsCompleted })

      // LOCAL-FIRST: Save to localStorage immediately (instant, never fails!)
      await localFirstStore.submitScore({
        identity,
        score,
        completionTime,
        remainingHp,
        worldsCompleted
      })

      console.log('✅ Score saved locally! Syncing to Supabase in background...')
      return Promise.resolve()
    } catch (error) {
      console.error('❌ Failed to save score locally:', error)
      return Promise.reject(error)
    }
  }

  // Create announcement
  const createAnnouncement = async (title: string, message: string, postedToFarcaster: boolean) => {
    if (!supabaseRef.current) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('📢 Creating announcement:', { title, message, postedToFarcaster })
      const { error } = await supabaseRef.current
        .from('announcement')
        .insert({
          title,
          message,
          posted_to_farcaster: postedToFarcaster
        })

      if (error) throw error
      console.log('✅ Announcement created')
    } catch (error) {
      console.error('❌ Failed to create announcement:', error)
      throw error
    }
  }

  // Delete announcement
  const deleteAnnouncement = async (announcementId: number) => {
    if (!supabaseRef.current) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('🗑️ Deleting announcement:', announcementId)
      const { error } = await supabaseRef.current
        .from('announcement')
        .delete()
        .eq('announcement_id', announcementId)

      if (error) throw error
      console.log('✅ Announcement deleted')
    } catch (error) {
      console.error('❌ Failed to delete announcement:', error)
      throw error
    }
  }

  // Consume dice attempt
  const consumeDiceAttempt = async (period: number) => {
    if (!supabaseRef.current || !identity) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('🎲 Consuming dice attempt for period:', period)

      // Find or create usage record
      const { data: existingUsage, error: findError } = await supabaseRef.current
        .from('user_dice_usage')
        .select('*')
        .eq('identity', identity)
        .eq('period', period)
        .single()

      if (findError && findError.code !== 'PGRST116') throw findError

      if (existingUsage) {
        // Update existing
        const freeRemaining = Math.max(0, 3 - existingUsage.rolls_used)
        const totalRemaining = freeRemaining + existingUsage.purchased_rolls

        if (totalRemaining === 0) {
          throw new Error('No dice attempts remaining for this period')
        }

        if (freeRemaining > 0) {
          // Consume free roll
          const { error: updateError } = await supabaseRef.current
            .from('user_dice_usage')
            .update({ rolls_used: existingUsage.rolls_used + 1 })
            .eq('id', existingUsage.id)

          if (updateError) throw updateError
          console.log('✅ FREE dice attempt consumed')
        } else {
          // Consume purchased roll
          const { error: updateError } = await supabaseRef.current
            .from('user_dice_usage')
            .update({ purchased_rolls: existingUsage.purchased_rolls - 1 })
            .eq('id', existingUsage.id)

          if (updateError) throw updateError
          console.log('✅ PURCHASED dice attempt consumed')
        }
      } else {
        // Create new record with first free roll used
        const { error: insertError } = await supabaseRef.current
          .from('user_dice_usage')
          .insert({
            identity,
            period,
            rolls_used: 1,
            purchased_rolls: 0
          })

        if (insertError) throw insertError
        console.log('✅ First dice attempt consumed')
      }
    } catch (error) {
      console.error('❌ Failed to consume dice attempt:', error)
      throw error
    }
  }

  // Add purchased rolls
  const addPurchasedRolls = async (period: number, amount: number) => {
    if (!supabaseRef.current || !identity) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('💰 Adding purchased dice rolls:', { period, amount })

      const { data: existingUsage, error: findError } = await supabaseRef.current
        .from('user_dice_usage')
        .select('*')
        .eq('identity', identity)
        .eq('period', period)
        .single()

      if (findError && findError.code !== 'PGRST116') throw findError

      if (existingUsage) {
        // Update existing
        const { error: updateError } = await supabaseRef.current
          .from('user_dice_usage')
          .update({ purchased_rolls: existingUsage.purchased_rolls + amount })
          .eq('id', existingUsage.id)

        if (updateError) throw updateError
      } else {
        // Create new
        const { error: insertError } = await supabaseRef.current
          .from('user_dice_usage')
          .insert({
            identity,
            period,
            rolls_used: 0,
            purchased_rolls: amount
          })

        if (insertError) throw insertError
      }

      console.log('✅ Purchased rolls added')
    } catch (error) {
      console.error('❌ Failed to add purchased rolls:', error)
      throw error
    }
  }

  // Clear all entries
  const clearAllEntries = async () => {
    if (!supabaseRef.current) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('🗑️ Clearing all entries...')

      // Delete all paid entries
      const { error: entryError } = await supabaseRef.current
        .from('entry')
        .delete()
        .neq('entry_id', 0) // Delete all

      if (entryError) throw entryError

      // Delete all fun entries
      const { error: funEntryError } = await supabaseRef.current
        .from('fun_entry')
        .delete()
        .neq('entry_id', 0) // Delete all

      if (funEntryError) throw funEntryError

      console.log('✅ All entries cleared')
    } catch (error) {
      console.error('❌ Failed to clear entries:', error)
      throw error
    }
  }

  // Reset to period one
  const resetToPeriodOne = async () => {
    if (!supabaseRef.current) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('🔄 Resetting to period 1...')
      const { error } = await supabaseRef.current
        .from('prize_pool')
        .update({
          current_distribution_period: 1,
          total_pool_amount: 0.0,
          last_distribution_timestamp: new Date().toISOString(),
          next_distribution_timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('pool_id', 1)

      if (error) throw error
      console.log('✅ Reset to period 1')
    } catch (error) {
      console.error('❌ Failed to reset period:', error)
      throw error
    }
  }

  // Clear all data
  const clearAllData = async () => {
    if (!supabaseRef.current) {
      throw new Error('Not connected to database')
    }

    try {
      console.log('💣 Clearing all data...')

      // Clear entries
      await clearAllEntries()

      // Clear dice usage
      const { error: diceError } = await supabaseRef.current
        .from('user_dice_usage')
        .delete()
        .neq('id', 0)

      if (diceError) throw diceError

      // Reset period
      await resetToPeriodOne()

      console.log('✅ All data cleared')
    } catch (error) {
      console.error('❌ Failed to clear all data:', error)
      throw error
    }
  }

  // Send chat message - LOCAL-FIRST VERSION
  const sendChatMessage = async (message: string, username: string, pfpUrl: string) => {
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty')
    }

    if (message.trim().length > 200) {
      throw new Error('Message too long (max 200 characters)')
    }

    try {
      console.log('💾 LOCAL-FIRST: Queuing chat message...')
      
      // LOCAL-FIRST: Add to sync queue (will be sent in background)
      await localFirstStore.sendChatMessage({
        message: message.trim(),
        username: username.trim(),
        pfpUrl: pfpUrl || ''
      })

      console.log('✅ Chat message queued! Sending in background...')
    } catch (error) {
      console.error('❌ Failed to queue chat message:', error)
      throw error
    }
  }

  return {
    connected,
    identity,
    statusMessage,
    prizePool,
    periodRevenueSummary,
    announcements,
    entries,
    freeEntries,
    prizeWinnings,
    userDiceUsage,
    chatMessages,
    isOnline,
    pendingSyncCount,
    startGameRun,
    submitRunResult,
    createAnnouncement,
    deleteAnnouncement,
    consumeDiceAttempt,
    addPurchasedRolls,
    clearAllEntries,
    resetToPeriodOne,
    clearAllData,
    sendChatMessage,
  }
}
