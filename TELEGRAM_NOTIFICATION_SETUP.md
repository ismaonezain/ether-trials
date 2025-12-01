# 📱 Telegram Notification Setup Guide

This guide will help you set up automatic Telegram notifications when a tournament period ends and prizes need to be allocated.

---

## 📋 Prerequisites

Before you begin, make sure you have:
1. ✅ A Telegram bot (create via @BotFather)
2. ✅ Your Telegram chat ID
3. ✅ Supabase Service Role Key
4. ✅ Database access to add new column

---

## 🗄️ Step 1: Add Database Field

You need to add a flag to track if notification has been sent for the current period.

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE prize_pool 
ADD COLUMN IF NOT EXISTS allocation_notified BOOLEAN DEFAULT FALSE;
```

This adds a new column `allocation_notified` to the `prize_pool` table to track whether we've already sent a notification for the current period.

---

## 🤖 Step 2: Create Telegram Bot (If You Don't Have One)

**Note:** The app already uses the feedback bot, so you can skip this step if you want to use the same bot.

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRstuVWXyz`)

---

## 🆔 Step 3: Get Your Chat ID

1. Search for `@userinfobot` on Telegram
2. Start a conversation
3. The bot will send you your **Chat ID** (e.g., `1234567890`)

---

## 🔧 Step 4: Configure Environment Variables

The bot token and chat ID are already hardcoded in the API route (same as feedback system).

If you want to use different credentials, update them in:
- `src/app/api/telegram-notify/route.ts` (lines 8-9)

You also need to set the Supabase Service Role Key in your `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find Service Role Key:**
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy the `service_role` key (NOT the `anon` key)

---

## 🎯 How It Works

### Automatic Check on User Entry

When a user enters the app, the system automatically:

1. ✅ **Checks if current period has ended**
   - Compares `next_distribution_timestamp` with current time
   - If current time > end time → period has ended

2. ✅ **Checks if notification was already sent**
   - Looks at `allocation_notified` flag in prize_pool table
   - If `true` → skip (notification already sent)
   - If `false` → proceed to send notification

3. ✅ **Sends Telegram notification**
   - Message includes:
     - Period number
     - End time
     - Action required: allocate prizes
     - Link to admin panel

4. ✅ **Updates flag to prevent duplicates**
   - Sets `allocation_notified = true`
   - Next user who enters won't trigger another notification

### Flow Diagram

```
User enters app
    ↓
Check: Has period ended?
    ↓ YES
Check: Already notified?
    ↓ NO
Send Telegram notification
    ↓
Update allocation_notified = TRUE
    ↓
Next user enters → No notification (already sent)
```

---

## 🧪 Testing

### Test the Notification

You can manually test by calling the API:

```bash
curl -X POST http://localhost:3000/api/telegram-notify \
  -H "Content-Type: application/json"
```

**Expected Response (if period ended and not yet notified):**
```json
{
  "message": "Notification sent successfully",
  "period": 1
}
```

**Expected Response (if already notified):**
```json
{
  "message": "Notification already sent",
  "skipped": true
}
```

**Expected Response (if period hasn't ended):**
```json
{
  "message": "Period has not ended yet",
  "hasEnded": false
}
```

---

## 🔄 Resetting Notification Flag

When you allocate prizes and start a new period, you should reset the flag:

```sql
UPDATE prize_pool 
SET allocation_notified = FALSE 
WHERE pool_id = 1;
```

This allows the notification to be sent again when the next period ends.

---

## 📊 Example Telegram Message

When a period ends, you'll receive:

```
🚨 Period 1 has ended!

⏰ End Time: 1/15/2025, 3:30:00 PM
💰 Action Required: Please allocate prizes for this period.

🔗 Go to Admin Panel to distribute rewards.
```

---

## 🐛 Troubleshooting

### Notification Not Sent

1. **Check database column exists:**
   ```sql
   SELECT * FROM prize_pool;
   ```
   - Make sure `allocation_notified` column exists

2. **Check period end time:**
   ```sql
   SELECT 
     current_distribution_period,
     next_distribution_timestamp,
     allocation_notified
   FROM prize_pool
   WHERE pool_id = 1;
   ```
   - Make sure `next_distribution_timestamp` is in the past

3. **Check environment variables:**
   - Make sure `SUPABASE_SERVICE_ROLE_KEY` is set

4. **Check Telegram bot:**
   - Make sure bot token is valid
   - Make sure you've started a conversation with the bot

### Notification Sent Multiple Times

- Check if flag is being updated properly
- Make sure only ONE user entry triggers the check

---

## 🎉 Done!

Your Telegram notification system is ready! You'll now receive automatic alerts when periods end and prizes need to be allocated.

**Key Benefits:**
- ✅ Never miss prize allocation deadlines
- ✅ Automatic notification (no manual checking)
- ✅ Only notified once per period (no spam)
- ✅ Clear action items in notification
