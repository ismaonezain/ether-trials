'use client'

import { useState, useEffect, useRef } from 'react'
import { Identity } from 'spacetimedb'
import * as moduleBindings from '../spacetime_module_bindings'

type DbConnection = moduleBindings.DbConnection
type EventContext = moduleBindings.EventContext
type PrizePool = moduleBindings.PrizePool
type PeriodRevenueSummary = moduleBindings.PeriodRevenueSummary
type Announcement = moduleBindings.Announcement
type Entry = moduleBindings.Entry
type FunEntry = moduleBindings.FunEntry
type PrizeWinnings = moduleBindings.PrizeWinnings
type UserDiceUsage = moduleBindings.UserDiceUsage

// Chat message interface (matching SpacetimeDB schema)
interface ChatMessage {
  messageId: bigint
  identity: Identity
  username: string
  message: string
  timestamp: { toMicroseconds: () => bigint }
  pfpUrl: string
}

export function useSpacetimeDB() {
  const [connected, setConnected] = useState(false)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [statusMessage, setStatusMessage] = useState('Connecting to leaderboard...')
  const [prizePool, setPrizePool] = useState<PrizePool | null>(null)
  const [periodRevenueSummary, setPeriodRevenueSummary] = useState<PeriodRevenueSummary[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [freeEntries, setFreeEntries] = useState<FunEntry[]>([])
  const [prizeWinnings, setPrizeWinnings] = useState<PrizeWinnings[]>([])
  const [userDiceUsage, setUserDiceUsage] = useState<UserDiceUsage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const connectionRef = useRef<DbConnection | null>(null)

  useEffect(() => {
    if (connectionRef.current) {
      console.log('⚠️ Connection already exists, skipping...')
      return
    }

    let isMounted = true // Track if component is still mounted

    const dbHost = 'wss://maincloud.spacetimedb.com'
    const dbName = process.env.NEXT_PUBLIC_SPACETIME_MODULE_NAME || 'anime_rpg_game'

    const onConnect = (connection: DbConnection, id: Identity, _token: string) => {
      if (!isMounted) {
        console.log('⚠️ Component unmounted during connection')
        return // Don't update state if unmounted
      }
      
      console.log('✅ Connected to SpacetimeDB!')
      console.log('🆔 Identity:', id.toHexString())
      console.log('🔗 Connection object:', !!connection)
      console.log('📊 Database tables:', !!connection.db)
      
      connectionRef.current = connection
      setIdentity(id)
      setConnected(true)
      setStatusMessage('Connected')

      // IMPORTANT: Register callbacks FIRST, then subscribe
      console.log('📋 Registering table callbacks...')

      // Register prize pool update callback
      connection.db.prizePool.onUpdate((_ctx: EventContext | undefined, _old: PrizePool, newPool: PrizePool) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('💰 Prize Pool UPDATED:', {
          total: newPool.totalPoolAmount,
          period: newPool.currentDistributionPeriod.toString()
        })
        setPrizePool(newPool)
      })

      // Register period revenue summary insert callback
      connection.db.periodRevenueSummary.onInsert((_ctx: EventContext | undefined, summary: PeriodRevenueSummary) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('💵 Period Revenue Summary INSERTED:', {
          period: summary.periodNumber.toString(),
          totalRevenue: summary.totalRevenue,
          participants: summary.participantsCount
        })
        setPeriodRevenueSummary(prev => [...prev, summary])
      })

      // Register announcement insert callback
      connection.db.announcement.onInsert((_ctx: EventContext | undefined, announcement: Announcement) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('📢 Announcement INSERTED:', {
          id: announcement.announcementId.toString(),
          title: announcement.title,
          message: announcement.message
        })
        setAnnouncements(prev => [announcement, ...prev])
      })

      // Register announcement delete callback
      connection.db.announcement.onDelete((_ctx: EventContext | undefined, announcement: Announcement) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('🗑️ Announcement DELETED:', announcement.announcementId.toString())
        setAnnouncements(prev => prev.filter(a => a.announcementId !== announcement.announcementId))
      })

      // Register entry insert callback
      connection.db.entry.onInsert((_ctx: EventContext | undefined, entry: Entry) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('🎯 Entry INSERTED:', {
          entryId: entry.entryId.toString(),
          username: entry.username,
          period: entry.period.toString(),
          score: entry.score.toString()
        })
        // Deduplicate by entryId to prevent double entries
        setEntries(prev => {
          const exists = prev.some(e => e.entryId.toString() === entry.entryId.toString())
          if (exists) {
            console.log('⚠️ Entry already exists, skipping insert')
            return prev
          }
          return [...prev, entry]
        })
      })

      // Register entry update callback
      connection.db.entry.onUpdate((_ctx: EventContext | undefined, _old: Entry, newEntry: Entry) => {
        if (!isMounted) return // Don't update state if unmounted
        console.log('🔄 Entry UPDATED:', {
          entryId: newEntry.entryId.toString(),
          username: newEntry.username,
          score: newEntry.score.toString()
        })
        setEntries(prev => prev.map(e => e.entryId === newEntry.entryId ? newEntry : e))
      })

      // Register fun_entry insert callback
      connection.db.funEntry.onInsert((_ctx: EventContext | undefined, entry: FunEntry) => {
        if (!isMounted) return
        console.log('🎯 Free Entry INSERTED:', {
          entryId: entry.entryId.toString(),
          username: entry.username,
          score: entry.score.toString()
        })
        // Deduplicate by entryId to prevent double entries
        setFreeEntries(prev => {
          const exists = prev.some(e => e.entryId.toString() === entry.entryId.toString())
          if (exists) {
            console.log('⚠️ Free Entry already exists, skipping insert')
            return prev
          }
          return [...prev, entry]
        })
      })

      // Register fun_entry update callback
      connection.db.funEntry.onUpdate((_ctx: EventContext | undefined, _old: FunEntry, newEntry: FunEntry) => {
        if (!isMounted) return
        console.log('🔄 Free Entry UPDATED:', {
          entryId: newEntry.entryId.toString(),
          username: newEntry.username,
          score: newEntry.score.toString()
        })
        setFreeEntries(prev => prev.map(e => e.entryId === newEntry.entryId ? newEntry : e))
      })

      // Register prize_winnings insert callback
      connection.db.prizeWinnings.onInsert((_ctx: EventContext | undefined, winnings: PrizeWinnings) => {
        if (!isMounted) return
        console.log('💰 Prize Winnings INSERTED:', {
          username: winnings.username,
          totalWinnings: winnings.totalWinnings
        })
        setPrizeWinnings(prev => [...prev, winnings])
      })

      // Register prize_winnings update callback
      connection.db.prizeWinnings.onUpdate((_ctx: EventContext | undefined, _old: PrizeWinnings, newWinnings: PrizeWinnings) => {
        if (!isMounted) return
        console.log('🔄 Prize Winnings UPDATED:', {
          username: newWinnings.username,
          totalWinnings: newWinnings.totalWinnings
        })
        setPrizeWinnings(prev => prev.map(w => w.identity.toHexString() === newWinnings.identity.toHexString() ? newWinnings : w))
      })

      // Register user_dice_usage insert callback
      connection.db.userDiceUsage.onInsert((_ctx: EventContext | undefined, usage: UserDiceUsage) => {
        if (!isMounted) return
        console.log('🎲 User Dice Usage INSERTED:', {
          identity: usage.identity.toHexString(),
          period: usage.period.toString(),
          rollsUsed: usage.rollsUsed
        })
        setUserDiceUsage(prev => [...prev, usage])
      })

      // Register user_dice_usage update callback
      connection.db.userDiceUsage.onUpdate((_ctx: EventContext | undefined, _old: UserDiceUsage, newUsage: UserDiceUsage) => {
        if (!isMounted) return
        console.log('🔄 User Dice Usage UPDATED:', {
          identity: newUsage.identity.toHexString(),
          period: newUsage.period.toString(),
          rollsUsed: newUsage.rollsUsed
        })
        setUserDiceUsage(prev => prev.map(u => u.id === newUsage.id ? newUsage : u))
      })

      // Register chat_message insert callback (if available)
      try {
        if (connection.db.chatMessage) {
          connection.db.chatMessage.onInsert((_ctx: EventContext | undefined, msg: ChatMessage) => {
            if (!isMounted) return
            console.log('💬 Chat Message INSERTED:', {
              messageId: msg.messageId.toString(),
              username: msg.username,
              message: msg.message
            })
            setChatMessages(prev => [...prev, msg])
          })
        }
      } catch (error) {
        console.warn('⚠️ Chat messages not yet supported (bindings need to be regenerated)')
      }

      console.log('✅ Callbacks registered!')

      // NOW subscribe to tables
      console.log('🔔 Subscribing to tables...')
      const queries = ['SELECT * FROM prize_pool', 'SELECT * FROM period_revenue_summary', 'SELECT * FROM announcement', 'SELECT * FROM entry', 'SELECT * FROM fun_entry', 'SELECT * FROM prize_winnings', 'SELECT * FROM user_dice_usage', 'SELECT * FROM chat_message']

      connection
        .subscriptionBuilder()
        .onApplied(() => {
          if (!isMounted) return // Don't update state if unmounted
          console.log('✅ Subscription applied!')

          // Try to load prize pool with error handling
          try {
            const pool = connection.db.prizePool?.poolId?.find(1n)
            if (pool) {
              console.log('💰 Prize pool loaded:', pool.totalPoolAmount, 'ETH')
              setPrizePool(pool)
            } else {
              console.warn('⚠️ Prize pool not found in initial cache')
            }
          } catch (error) {
            console.error('❌ Error loading prize pool:', error)
          }

          // Process initial period revenue summary
          try {
            const summaryEntries: PeriodRevenueSummary[] = []
            for (const summary of connection.db.periodRevenueSummary.iter()) {
              summaryEntries.push(summary)
            }
            console.log('💵 Initial period revenue summary loaded:', summaryEntries.length, 'entries')
            setPeriodRevenueSummary(summaryEntries)
          } catch (error) {
            console.error('❌ Error loading period revenue summary:', error)
            setPeriodRevenueSummary([])
          }

          // Process initial announcements
          try {
            const announcementEntries: Announcement[] = []
            for (const announcement of connection.db.announcement.iter()) {
              announcementEntries.push(announcement)
            }
            // Sort by createdAt descending (newest first)
            announcementEntries.sort((a, b) => Number(b.createdAt.toMicroseconds() - a.createdAt.toMicroseconds()))
            console.log('📢 Initial announcements loaded:', announcementEntries.length, 'entries')
            console.log('📢 Announcement details:', announcementEntries.map(a => ({ id: a.announcementId?.toString(), title: a.title })))
            setAnnouncements(announcementEntries)
          } catch (error) {
            console.error('❌ Error loading announcements:', error)
            setAnnouncements([])
          }

          // Process initial entries
          try {
            const entryList: Entry[] = []
            for (const entry of connection.db.entry.iter()) {
              entryList.push(entry)
            }
            console.log('🎯 Initial entries loaded:', entryList.length, 'entries')
            setEntries(entryList)
          } catch (error) {
            console.error('❌ Error loading entries:', error)
            setEntries([])
          }

          // Process initial fun_entry
          try {
            const freeEntryList: FunEntry[] = []
            for (const entry of connection.db.funEntry.iter()) {
              freeEntryList.push(entry)
            }
            console.log('🎮 Initial free entries loaded:', freeEntryList.length, 'entries')
            setFreeEntries(freeEntryList)
          } catch (error) {
            console.error('❌ Error loading free entries:', error)
            setFreeEntries([])
          }

          // Process initial prize_winnings
          try {
            const prizeWinningsList: PrizeWinnings[] = []
            for (const winnings of connection.db.prizeWinnings.iter()) {
              prizeWinningsList.push(winnings)
            }
            console.log('💰 Initial prize winnings loaded:', prizeWinningsList.length, 'entries')
            setPrizeWinnings(prizeWinningsList)
          } catch (error) {
            console.error('❌ Error loading prize winnings:', error)
            setPrizeWinnings([])
          }

          // Process initial user_dice_usage
          try {
            const userDiceUsageList: UserDiceUsage[] = []
            for (const usage of connection.db.userDiceUsage.iter()) {
              userDiceUsageList.push(usage)
            }
            console.log('🎲 Initial user dice usage loaded:', userDiceUsageList.length, 'entries')
            setUserDiceUsage(userDiceUsageList)
          } catch (error) {
            console.error('❌ Error loading user dice usage:', error)
            setUserDiceUsage([])
          }

          // Process initial chat messages
          try {
            if (connection.db.chatMessage) {
              const chatMessageList: ChatMessage[] = []
              for (const msg of connection.db.chatMessage.iter()) {
                chatMessageList.push(msg)
              }
              // Sort by timestamp (oldest first for chat display)
              chatMessageList.sort((a, b) => Number(a.timestamp.toMicroseconds() - b.timestamp.toMicroseconds()))
              console.log('💬 Initial chat messages loaded:', chatMessageList.length, 'messages')
              setChatMessages(chatMessageList)
            }
          } catch (error) {
            console.warn('⚠️ Chat messages not yet available (bindings need regeneration):', error)
            setChatMessages([])
          }
        })
        .onError((error: Error) => {
          if (!isMounted) return // Don't update state if unmounted
          console.error('❌ Subscription error:', error)
          setStatusMessage(`Error: ${error.message}`)
        })
        .subscribe(queries)
    }

    const onDisconnect = (_ctx: moduleBindings.ErrorContext, reason?: Error | null) => {
      if (!isMounted) return // Don't update state if unmounted
      const reasonStr = reason ? reason.message : 'No reason given'
      console.log('❌ Disconnected:', reasonStr)
      setStatusMessage(`Disconnected: ${reasonStr}`)
      connectionRef.current = null
      setIdentity(null)
      setConnected(false)
    }

    console.log('🔌 Connecting to SpacetimeDB...')
    console.log('🌐 Host:', dbHost)
    console.log('📦 Module:', dbName)

    moduleBindings.DbConnection.builder()
      .withUri(dbHost)
      .withModuleName(dbName)
      .onConnect(onConnect)
      .onDisconnect(onDisconnect)
      .build()

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up SpacetimeDB connection...')
      isMounted = false
      if (connectionRef.current) {
        try {
          connectionRef.current.disconnect()
          console.log('✅ Connection closed')
        } catch (error) {
          console.error('❌ Error closing connection:', error)
        }
        connectionRef.current = null
      }
    }
  }, [])

  const startGameRun = (username: string, characterClass: string, paidEntryAmount: number, walletAddress: string, pfpUrl?: string, period?: number, build?: string, fid?: number) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot start game run: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    // CRITICAL: Validate username before sending to backend
    if (!username || username.trim().length === 0) {
      console.error('❌ Cannot start game run: username is empty!')
      console.error('Username value:', username)
      throw new Error('Username is required')
    }
    
    const cleanUsername = username.trim()
    
    try {
      // Use different reducer functions based on entry amount
      if (paidEntryAmount === 0) {
        // FREE ENTRY - For Fun Mode
        const periodToSend = period || 0;
        const fidToSend = fid || 0; // Default to 0 if no FID available
        console.log('🎮 Starting FREE game run with username:', cleanUsername)
        console.log('📋 Full details:', {
          username: cleanUsername,
          characterClass,
          period: periodToSend,
          fid: fidToSend,
          walletAddress: walletAddress ? walletAddress.slice(0, 10) + '...' : 'none'
        })
        // CRITICAL: Parameter order must match backend reducer!
        // Backend: (username, character_class, period, wallet_address, pfp_url)
        // NOTE: FID parameter not yet supported in SpacetimeDB reducer
        connectionRef.current.reducers.startFreeGameRun(
          cleanUsername, 
          characterClass, 
          BigInt(periodToSend),
          walletAddress || '', 
          pfpUrl || ''
        )
        console.log('✅ FREE game run registered to SpacetimeDB with period:', periodToSend)
      } else {
        // PAID ENTRY - Prize Pool Mode
        const periodToSend = period || 0;
        const fidToSend = fid || 0; // Default to 0 if no FID available
        console.log('💎 Starting PAID game run with username:', cleanUsername)
        console.log('📋 Full details:', {
          username: cleanUsername,
          characterClass,
          build: build || 'Unknown-Unknown',
          paidEntryAmount,
          period: periodToSend,
          fid: fidToSend,
          walletAddress: walletAddress.slice(0, 10) + '...'
        })
        connectionRef.current.reducers.startPaidGameRun(
          cleanUsername, 
          characterClass, 
          build || 'Unknown-Unknown', 
          paidEntryAmount, 
          BigInt(periodToSend), 
          BigInt(fidToSend),
          walletAddress, 
          pfpUrl || ''
        )
        console.log('✅ PAID game run registered to SpacetimeDB with period:', periodToSend, 'fid:', fidToSend, 'and build:', build)
      }
    } catch (error) {
      console.error('❌ Failed to register game run:', error)
      throw error // Re-throw so caller can handle
    }
  }

  const submitRunResult = (score: number, completionTime: number, remainingHp: number, worldsCompleted: number) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot submit score: not connected')
      return Promise.reject(new Error('Not connected to SpacetimeDB'))
    }
    
    try {
      console.log('📊 Submitting score:', {
        score,
        completionTime,
        remainingHp,
        worldsCompleted
      })
      connectionRef.current.reducers.submitRunResult(BigInt(score), completionTime, remainingHp, worldsCompleted)
      console.log('✅ Score submitted successfully to SpacetimeDB')
      return Promise.resolve()
    } catch (error) {
      console.error('❌ Failed to submit score:', error)
      // Re-throw error so caller can handle it properly
      return Promise.reject(error)
    }
  }



  const createAnnouncement = (title: string, message: string, postedToFarcaster: boolean) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot create announcement: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('📢 Creating announcement:', { title, message, postedToFarcaster })
      connectionRef.current.reducers.createAnnouncement(title, message, postedToFarcaster)
      console.log('✅ Announcement created')
    } catch (error) {
      console.error('❌ Failed to create announcement:', error)
      throw error // Re-throw so caller can handle
    }
  }

  const deleteAnnouncement = (announcementId: bigint) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot delete announcement: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('🗑️ Deleting announcement:', announcementId.toString())
      connectionRef.current.reducers.deleteAnnouncement(announcementId)
      console.log('✅ Announcement deleted')
    } catch (error) {
      console.error('❌ Failed to delete announcement:', error)
      throw error // Re-throw so caller can handle
    }
  }

  // Consume dice attempt (for paid mode period-based dice rolls)
  const consumeDiceAttempt = (period: number) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot consume dice attempt: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('🎲 Consuming dice attempt for period:', period)
      connectionRef.current.reducers.consumeDiceAttempt(BigInt(period))
      console.log('✅ Dice attempt consumed successfully')
    } catch (error) {
      console.error('❌ Failed to consume dice attempt:', error)
      throw error // Re-throw so caller can handle
    }
  }

  // resetFunEntries removed - free entries now use period-based system like paid entries

  // Add purchased dice rolls (for paid mode)
  const addPurchasedRolls = (period: number, amount: number) => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot add purchased rolls: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('💰 Adding purchased dice rolls:', { period, amount })
      connectionRef.current.reducers.addPurchasedRolls(BigInt(period), amount)
      console.log('✅ Purchased rolls added successfully')
    } catch (error) {
      console.error('❌ Failed to add purchased rolls:', error)
      throw error // Re-throw so caller can handle
    }
  }

  // Clear all entries (paid and free) from all periods
  const clearAllEntries = () => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot clear entries: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('🗑️ Clearing all entries...')
      connectionRef.current.reducers.clearAllEntries()
      console.log('✅ All entries cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear entries:', error)
      throw error
    }
  }

  // Reset prize pool to period 1
  const resetToPeriodOne = () => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot reset period: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('🔄 Resetting to period 1...')
      connectionRef.current.reducers.resetToPeriodOne()
      console.log('✅ Reset to period 1 successfully')
    } catch (error) {
      console.error('❌ Failed to reset period:', error)
      throw error
    }
  }

  // Clear all data (entries + dice usage + reset period)
  const clearAllData = () => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot clear all data: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('💣 Clearing all data...')
      connectionRef.current.reducers.clearAllData()
      console.log('✅ All data cleared successfully')
    } catch (error) {
      console.error('❌ Failed to clear all data:', error)
      throw error
    }
  }

  // Send chat message
  const sendChatMessage = (message: string, username: string, pfpUrl: string = '') => {
    if (!connectionRef.current || !identity) {
      console.error('❌ Cannot send chat message: not connected')
      throw new Error('Not connected to SpacetimeDB')
    }
    
    try {
      console.log('💬 Sending chat message:', { username, message, pfpUrl })
      // Call reducer directly with proper method call
      if (typeof connectionRef.current.reducers.sendChatMessage === 'function') {
        connectionRef.current.reducers.sendChatMessage(username, message, pfpUrl)
        console.log('✅ Chat message sent successfully')
      } else {
        throw new Error('sendChatMessage reducer not available (bindings not regenerated)')
      }
    } catch (error) {
      console.error('❌ Failed to send chat message:', error)
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
