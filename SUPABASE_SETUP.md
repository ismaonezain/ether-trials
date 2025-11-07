# 🚀 Supabase Migration Guide

This guide will help you migrate from SpacetimeDB to Supabase for a more stable and mature database solution.

## 📋 Prerequisites

- Supabase account (free tier available at [supabase.com](https://supabase.com))
- Node.js installed
- Access to your project's environment variables

## 🎯 Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project Name**: `anime-rpg-game` (or your preferred name)
   - **Database Password**: (choose a strong password - save this!)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
4. Click "Create new project"
5. Wait 2-3 minutes for project provisioning

## 🔑 Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Settings** → **API** in the Supabase dashboard
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## 📝 Step 3: Configure Environment Variables

Create or update your `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Keep your existing environment variables
NEXT_PUBLIC_SPACETIME_MODULE_NAME=anime_rpg_game
# ... other variables
```

⚠️ **Important**: Replace `your-project.supabase.co` and `your-anon-key-here` with your actual values from Step 2.

## 🗄️ Step 4: Run Database Migration

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project
4. Copy the entire contents
5. Paste into the Supabase SQL Editor
6. Click "Run" button
7. Wait for "Success. No rows returned" message

This will create all necessary tables:
- `game_run` - Game sessions
- `prize_pool` - Prize pool management
- `period_revenue_summary` - Period statistics
- `announcement` - System announcements
- `entry` - Paid tournament entries
- `fun_entry` - Free mode entries
- `prize_winnings` - User winnings
- `user_dice_usage` - Dice roll tracking

## 🔄 Step 5: Update Your Code

### Option A: Switch Hook Import (Recommended)

Find and replace in your codebase:

```typescript
// OLD (SpacetimeDB):
import { useSpacetimeDB } from '@/hooks/useSpacetimeDB'
const { connected, entries, ... } = useSpacetimeDB()

// NEW (Supabase):
import { useSupabase } from '@/hooks/useSupabase'
const { connected, entries, ... } = useSupabase()
```

The API is identical! Just change the import.

### Option B: Rename Hook (For Seamless Migration)

If you want zero code changes in components:

```bash
# Backup SpacetimeDB hook
mv src/hooks/useSpacetimeDB.ts src/hooks/useSpacetimeDB.backup.ts

# Rename Supabase hook
mv src/hooks/useSupabase.ts src/hooks/useSpacetimeDB.ts

# Update the export in the new file
# Change: export function useSupabase()
# To: export function useSpacetimeDB()
```

This way, all existing imports will work without changes!

## ✅ Step 6: Test Your Application

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Check the browser console for connection messages:
   ```
   🔌 Connecting to Supabase...
   ✅ Connected to Supabase!
   💰 Prize pool loaded: 0 ETH
   🎯 Paid entries loaded: 0 entries
   🎮 Fun entries loaded: 0 entries
   ```

3. Test core functionality:
   - ✅ Start a free game
   - ✅ Submit score
   - ✅ Check leaderboard
   - ✅ Start a paid game (if applicable)
   - ✅ Admin functions

## 🎨 Step 7: Verify Realtime Features

Realtime subscriptions should work automatically! Open two browser windows:

1. **Window 1**: Play a game and submit score
2. **Window 2**: Watch the leaderboard update in real-time ✨

## 🗑️ Step 8: Clean Up (Optional)

Once everything works with Supabase:

1. Remove SpacetimeDB dependency:
   ```bash
   npm uninstall spacetimedb
   ```

2. Delete SpacetimeDB files:
   ```bash
   rm -rf spacetime-server/
   rm -rf src/spacetime_module_bindings/
   rm src/hooks/useSpacetimeDB.backup.ts  # if you made backup
   ```

3. Remove from `package.json` if still listed:
   ```json
   "spacetimedb": "^1.6.1"  // DELETE THIS LINE
   ```

## 🔍 Troubleshooting

### Issue: "Database configuration missing"
**Solution**: Double-check your `.env.local` file has the correct Supabase credentials.

### Issue: "relation does not exist"
**Solution**: Make sure you ran the migration SQL script in Step 4.

### Issue: Realtime not working
**Solution**: Check Supabase dashboard → Database → Replication. Ensure all tables are enabled for realtime.

### Issue: CORS errors
**Solution**: Supabase automatically handles CORS. If issues persist, check your Supabase project settings.

## 📊 Database Management

### View Data
- Go to **Table Editor** in Supabase dashboard
- Click on any table to view/edit data
- Much easier than SpacetimeDB CLI!

### Run Queries
- Go to **SQL Editor**
- Write any PostgreSQL query
- Examples:
  ```sql
  -- View all entries for current period
  SELECT * FROM entry 
  WHERE period = (SELECT current_distribution_period FROM prize_pool WHERE pool_id = 1)
  ORDER BY score DESC;

  -- View top 10 players
  SELECT username, score, class_name 
  FROM entry 
  ORDER BY score DESC 
  LIMIT 10;

  -- Clear all entries (admin)
  DELETE FROM entry;
  DELETE FROM fun_entry;
  ```

### Backup Data
- Go to **Settings** → **Database**
- Click "Create backup"
- Automatic daily backups on paid plans

## 🎉 Benefits of Supabase

✅ **Stability** - PostgreSQL is battle-tested and mature  
✅ **Realtime** - Built-in subscriptions like SpacetimeDB  
✅ **Developer Tools** - Amazing dashboard for data viewing  
✅ **Scalability** - Handles millions of rows easily  
✅ **Free Tier** - Generous limits for development  
✅ **Documentation** - Excellent docs and community  
✅ **Security** - Row Level Security built-in  
✅ **Backups** - Automatic backups and point-in-time recovery  

## 🚀 Next Steps

Now that you're on Supabase:

1. **Explore the Dashboard** - Get familiar with Table Editor, SQL Editor, and API docs
2. **Set Up Backups** - Enable automatic backups for peace of mind
3. **Monitor Usage** - Check usage stats to stay within free tier limits
4. **Add Authentication** - Supabase has built-in auth if you need user accounts
5. **Deploy to Production** - Much more reliable than SpacetimeDB!

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Supabase Discord](https://discord.supabase.com/) - Great community support

---

**Need Help?** 

If you encounter any issues during migration, check:
1. Browser console for error messages
2. Supabase dashboard logs (Settings → Logs)
3. This guide's troubleshooting section

Good luck with your migration! 🎮✨
