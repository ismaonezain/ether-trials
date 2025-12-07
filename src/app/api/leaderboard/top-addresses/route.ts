import { NextResponse } from 'next/server';

/**
 * API endpoint to fetch top 1000 player addresses from SpacetimeDB
 * This is called by the admin panel to get leaderboard data for prize allocation
 */
export async function GET() {
  try {
    // Connect to SpacetimeDB and fetch leaderboard
    const SPACETIME_HOST = '';
    const MODULE_NAME = process.env.NEXT_PUBLIC_SPACETIME_MODULE_NAME || 'anime_rpg_game';
    
    // Fetch leaderboard via SpacetimeDB HTTP API
    const httpUrl = SPACETIME_HOST.replace('wss://', 'https://').replace('ws://', 'http://');
    const queryUrl = `${httpUrl}/database/sql/${MODULE_NAME}`;
    
    // Query leaderboard table sorted by best_score desc, best_time asc
    const query = 'SELECT identity, username, character_class, best_score, best_time_seconds FROM leaderboard ORDER BY best_score DESC, best_time_seconds ASC LIMIT 1000';
    
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_str: query }),
    });

    if (!response.ok) {
      console.error('SpacetimeDB query failed:', response.statusText);
      throw new Error('Failed to query leaderboard from SpacetimeDB');
    }

    const data = await response.json();
    
    // Extract identity addresses from results
    // Identity in SpacetimeDB is represented as bytes, convert to hex string
    const addresses: string[] = [];
    
    if (data.rows && Array.isArray(data.rows)) {
      for (const row of data.rows) {
        // row[0] should be identity field
        if (row[0]) {
          // Convert identity to hex string format
          const identity = row[0];
          let addressStr = '';
          
          if (typeof identity === 'string') {
            addressStr = identity;
          } else if (identity.bytes) {
            // If identity has bytes field, convert to hex
            const bytes = identity.bytes;
            addressStr = '0x' + Array.from(bytes as Uint8Array)
              .map((b: number) => b.toString(16).padStart(2, '0'))
              .join('');
          }
          
          if (addressStr) {
            addresses.push(addressStr);
          }
        }
      }
    }

    console.log(`Fetched ${addresses.length} player addresses from leaderboard`);

    return NextResponse.json({
      success: true,
      addresses,
      count: addresses.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching leaderboard addresses:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch leaderboard addresses',
        addresses: [],
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
