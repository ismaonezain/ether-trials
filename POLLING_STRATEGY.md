# Polling Strategy for Real-time Updates

## Overview

This app uses **smart polling** instead of WebSocket subscriptions to achieve near real-time updates without requiring Supabase Realtime (which is early access/premium feature).

## Why Polling?

✅ **Universal Compatibility** - Works with any Supabase plan
✅ **No Extra Setup** - No need to enable Realtime replication
✅ **Predictable Costs** - Standard database queries only
✅ **Reliable** - No WebSocket connection issues
✅ **Good UX** - 3-second updates feel instant for users

## Polling Intervals

### Leaderboard Data
```typescript
// Polls every 3 seconds
- entry table (paid mode)
- fun_entry table (free mode)
```
**Why 3s?** Balance between responsiveness and database load. Users expect to see their score appear quickly after submission.

### Prize Pool
```typescript
// Polls every 5 seconds
- prize_pool table
```
**Why 5s?** Prize pool changes less frequently. 5s keeps it updated without excessive queries.

### Announcements
```typescript
// Polls every 10 seconds
- announcement table
```
**Why 10s?** Announcements are infrequent. 10s is sufficient for admin messages.

## Smart Optimizations

### 1. **Conditional Polling**
```typescript
useEffect(() => {
  if (!isReady) return; // Don't poll until initialized
  
  const pollInterval = setInterval(() => {
    fetchLeaderboard();
  }, 3000);
  
  return () => clearInterval(pollInterval);
}, [isReady, isFreeMode]);
```

### 2. **Cleanup on Unmount**
All polling intervals are properly cleared when components unmount to prevent memory leaks.

### 3. **Immediate Fetch on Actions**
When user submits a score, we immediately fetch the leaderboard rather than waiting for the next poll:
```typescript
await submitScore(data);
fetchLeaderboard(); // Immediate update
```

## Database Load

### Example: 10 concurrent users
- **Leaderboard**: 10 users × 20 queries/min = 200 queries/min
- **Prize Pool**: 10 users × 12 queries/min = 120 queries/min
- **Announcements**: 10 users × 6 queries/min = 60 queries/min
- **Total**: ~380 queries/min = ~23K queries/hour

Supabase free tier: **500K queries/month** - plenty of headroom! 🚀

### Example: 100 concurrent users
- **Total**: ~3,800 queries/min = ~230K queries/hour
- Still within free tier limits for reasonable traffic

## Upgrade Path

If your app scales to thousands of concurrent users:

1. **Enable Supabase Realtime** (if available)
   - Switch to WebSocket subscriptions
   - Instant updates without polling
   - Lower database load

2. **Increase Polling Intervals**
   - Leaderboard: 3s → 5s
   - Prize Pool: 5s → 10s
   - Still feels responsive

3. **Implement Smart Polling**
   - Poll faster when game is active
   - Slower when idle
   - Pause when tab is hidden

## Code Example: Converting to Realtime

If you get Realtime access, simply uncomment this code in `useSupabase.ts`:

```typescript
// Replace polling with realtime subscription
const channel = supabase
  .channel('leaderboard-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: isFreeMode ? 'fun_entry' : 'entry'
    },
    () => {
      fetchLeaderboard();
    }
  )
  .subscribe();

return () => {
  supabase.removeChannel(channel);
};
```

## Performance Monitoring

Monitor these metrics in Supabase dashboard:
- **Query count** - Should stay under limits
- **Response time** - Should be <100ms
- **Error rate** - Should be <0.1%

## Best Practices

✅ **DO:**
- Use polling for low-frequency updates (<1 update/sec)
- Clear intervals on cleanup
- Fetch immediately after user actions
- Monitor database usage

❌ **DON'T:**
- Poll faster than 1 second (use Realtime instead)
- Forget to cleanup intervals
- Poll when data won't change
- Ignore database limits

## Conclusion

Polling is a **production-ready** solution for this tournament platform:
- ✅ Reliable and predictable
- ✅ Works on all Supabase plans
- ✅ Good user experience (3s updates)
- ✅ Scalable for reasonable traffic
- ✅ Easy to upgrade to Realtime later

Your users won't notice the difference between 3-second polling and instant WebSocket updates! 🎮⚔️
