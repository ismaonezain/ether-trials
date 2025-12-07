import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Telegram bot token and chat ID (same as feedback)
const TELEGRAM_BOT_TOKEN = '';
const TELEGRAM_CHAT_ID = '';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // No need for period parameter - we check the prize_pool table directly

    // Check if Telegram credentials are configured
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn('⚠️ Telegram credentials not configured');
      return NextResponse.json(
        { error: 'Telegram not configured' },
        { status: 500 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check prize pool for current period status
    const { data: prizePoolData, error: poolError } = await supabase
      .from('prize_pool')
      .select('pool_id, current_distribution_period, next_distribution_timestamp, allocation_notified')
      .eq('pool_id', 1)
      .single();

    if (poolError) {
      console.error('❌ Failed to fetch prize pool:', poolError);
      return NextResponse.json(
        { error: 'Failed to fetch prize pool data' },
        { status: 500 }
      );
    }

    if (!prizePoolData) {
      return NextResponse.json(
        { error: 'Prize pool not found' },
        { status: 404 }
      );
    }

    // Check if period has ended
    const periodEndTime = new Date(prizePoolData.next_distribution_timestamp).getTime();
    const currentTime = Date.now();
    const hasEnded = currentTime > periodEndTime;

    // If period hasn't ended yet, no action needed
    if (!hasEnded) {
      console.log('ℹ️ Period has not ended yet');
      return NextResponse.json(
        { message: 'Period has not ended yet', hasEnded: false },
        { status: 200 }
      );
    }

    // If already notified, skip
    if (prizePoolData.allocation_notified) {
      console.log('ℹ️ Notification already sent for period', prizePoolData.current_distribution_period);
      return NextResponse.json(
        { message: 'Notification already sent', skipped: true },
        { status: 200 }
      );
    }

    // Send Telegram notification
    const message = `🚨 *Period ${prizePoolData.current_distribution_period} has ended!*\n\n⏰ End Time: ${new Date(prizePoolData.next_distribution_timestamp).toLocaleString()}\n💰 Action Required: Please allocate prizes for this period.\n\n🔗 Go to Admin Panel to distribute rewards.`;

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!telegramResponse.ok) {
      const errorData = await telegramResponse.json();
      console.error('❌ Telegram API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to send Telegram notification', details: errorData },
        { status: 500 }
      );
    }

    // Mark notification as sent
    const { error: updateError } = await supabase
      .from('prize_pool')
      .update({ allocation_notified: true })
      .eq('pool_id', 1);

    if (updateError) {
      console.error('❌ Failed to update notification flag:', updateError);
      // Don't fail the request - notification was sent successfully
    }

    console.log('✅ Telegram notification sent for period', prizePoolData.current_distribution_period);
    return NextResponse.json(
      { message: 'Notification sent successfully', period: prizePoolData.current_distribution_period },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error in telegram-notify:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
