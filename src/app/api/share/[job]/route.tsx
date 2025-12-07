import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

// Job to image URL mapping
const JOB_IMAGES: Record<string, string> = {
  'Assassin': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/c9e08baf-a03e-4a8a-ac4f-8df13c101bd0-SyooX425UEVl9yvZHumcxqkRRG8wHd',
  'Cook': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/533237ed-f0e3-4081-a711-a6dd288ecdc9-ogoWZZvx6yInE4A8zy641R0I1FCAuE',
  'Mage': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/01c48375-84c9-42e8-b769-12086cc7893a-mLtAv1rgA8zfwco0FaU82CTL3W6omW',
  'Paladin': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/21791fc9-b1f8-4f24-a3f2-3ad30e5778ac-Oa61oXdNXkFFiXaAPtfxBMtsftfSDA',
  'Ranger': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9f5e6dc1-42ab-49bc-ab30-f41e000b3645-8mz98RwzkhShxVlFPEfpLixQKb1r1m',
  'Warrior': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9582d8a6-3150-4c87-a8f8-3ea4917e9254-7AqZUr9R06fsZlcMI4QBvW1UcAtoLV'
};

// Format number with commas
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Get tier color
function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    'COMPLETED': '#9CA3AF',
    'GOOD': '#60A5FA',
    'GREAT': '#A78BFA',
    'EXCELLENT': '#F59E0B',
    'PERFECT': '#EC4899',
    'FLAWLESS': '#EF4444'
  };
  return colors[tier] || '#9CA3AF';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { job: string } }
): Promise<Response> {
  const job = params.job;
  const searchParams = request.nextUrl.searchParams;
  
  // Check if this is OG image request
  const isOgImage = searchParams.get('og') === 'true';
  
  const scoreStr = searchParams.get('score') || '0';
  const score = parseInt(scoreStr, 10) || 0;
  const tier = searchParams.get('tier') || 'COMPLETED';
  const mode = searchParams.get('mode') || 'fun';
  const stage = searchParams.get('stage') || '0';
  const period = searchParams.get('period') || '0';
  const pfpUrl = searchParams.get('pfp') || '';
  const username = searchParams.get('username') || 'Anonymous';
  
  // Get job-specific image
  const imageUrl = JOB_IMAGES[job] || JOB_IMAGES['Warrior'];
  
  // Generate OG Image with ImageResponse
  if (isOgImage) {
    const tierColor = getTierColor(tier);
    
    return new ImageResponse(
      (
        <div
          style={{
            width: '900px',
            height: '600px',
            display: 'flex',
            position: 'relative',
            backgroundColor: '#000',
          }}
        >
          {/* Background Job Image */}
          <img
            src={imageUrl}
            alt={job}
            style={{
              width: '900px',
              height: '600px',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
          
          {/* Dark Overlay for better text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
              display: 'flex',
            }}
          />
          
          {/* Content Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '40px',
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Top Section - Game Title + User Profile */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#FFF',
                  textShadow: '0 0 20px rgba(251, 191, 36, 0.8), 0 4px 8px rgba(0,0,0,0.8)',
                  display: 'flex',
                }}
              >
                ⚔️ ETHER TRIALS ⚔️
              </div>
              
              {/* User Profile */}
              {pfpUrl && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    border: '2px solid rgba(251, 191, 36, 0.5)',
                  }}
                >
                  <img
                    src={pfpUrl}
                    alt="Profile"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '3px solid #FBBF24',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#FBBF24',
                      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                      display: 'flex',
                    }}
                  >
                    @{username}
                  </div>
                </div>
              )}
            </div>
            
            {/* Middle Section - Achievement */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: tierColor,
                  textShadow: `0 0 30px ${tierColor}, 0 4px 12px rgba(0,0,0,0.9)`,
                  textTransform: 'uppercase',
                  display: 'flex',
                  letterSpacing: '4px',
                }}
              >
                {tier}
              </div>
              
              <div
                style={{
                  fontSize: '36px',
                  color: '#FFF',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  display: 'flex',
                }}
              >
                {job} Class
              </div>
            </div>
            
            {/* Bottom Section - Stats */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '24px',
                borderRadius: '16px',
                border: '2px solid rgba(251, 191, 36, 0.5)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '28px',
                  color: '#FFF',
                }}
              >
                <span style={{ color: '#FBBF24', fontWeight: 'bold' }}>Score:</span>
                <span style={{ fontWeight: 'bold' }}>{formatNumber(score)}</span>
              </div>
              
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '24px',
                  color: '#FFF',
                }}
              >
                <span style={{ color: '#9CA3AF' }}>Stage {stage} • Period {period}</span>
                <span style={{ color: '#9CA3AF' }}>{mode === 'paid' ? '🏆 Prize Pool' : '🎮 For Fun'}</span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 900,
        height: 600,
      }
    );
  }
  
  // Create miniapp embed metadata with OG image URL
  const ogImageUrl = `${request.nextUrl.origin}/api/share/${encodeURIComponent(job)}?og=true&score=${score}&tier=${encodeURIComponent(tier)}&mode=${mode}&stage=${stage}&period=${period}`;
  
  const embedData = {
    version: "1",
    imageUrl: ogImageUrl,
    button: {
      title: "⚔️ Play Now",
      action: {
        type: "launch_frame",
        name: "Ether Trials",
        url: "https://bat-been-379.app.ohara.ai",
        splashImageUrl: "https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/farcaster/splash_images/splash_image1.svg",
        splashBackgroundColor: "#000000"
      }
    }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ether Trials - ${job} ${tier} Rank</title>
  
  <!-- Mini App Embed Metadata -->
  <meta name="fc:miniapp" content='${JSON.stringify(embedData)}' />
  <meta name="fc:frame" content='${JSON.stringify(embedData)}' />
  
  <!-- Standard OpenGraph -->
  <meta property="og:title" content="Ether Trials - ${tier} Rank Achieved!" />
  <meta property="og:description" content="Just achieved ${tier} rank with ${job} class! Score: ${formatNumber(score)}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="900" />
  <meta property="og:image:height" content="600" />
  <meta property="og:url" content="${request.nextUrl.toString()}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Ether Trials - ${tier} Rank!" />
  <meta name="twitter:description" content="${job} class - Score: ${formatNumber(score)}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(to bottom, #000000, #1a0033, #000000);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 600px;
      padding: 2rem;
      text-align: center;
    }
    .hero-image {
      width: 100%;
      max-width: 500px;
      border-radius: 12px;
      border: 3px solid #fbbf24;
      margin: 2rem auto;
      display: block;
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
    }
    .title {
      font-size: 2rem;
      font-weight: bold;
      background: linear-gradient(to right, #fbbf24, #ef4444);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }
    .achievement {
      font-size: 2.5rem;
      font-weight: bold;
      color: ${getTierColor(tier)};
      text-shadow: 0 0 20px ${getTierColor(tier)};
      margin: 1rem 0;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin: 2rem 0;
    }
    .stat-card {
      background: rgba(0, 0, 0, 0.7);
      border: 2px solid rgba(251, 191, 36, 0.3);
      padding: 1rem;
      border-radius: 8px;
    }
    .stat-label {
      color: #fbbf24;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 1.25rem;
      font-weight: bold;
    }
    .cta-button {
      background: linear-gradient(to right, #16a34a, #2563eb);
      color: white;
      padding: 1rem 2rem;
      border-radius: 8px;
      border: 2px solid #16a34a;
      font-size: 1.125rem;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin-top: 1rem;
    }
    .cta-button:hover {
      background: linear-gradient(to right, #15803d, #1d4ed8);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">⚔️ Ether Trials ⚔️</h1>
    <div class="achievement">${tier}</div>
    
    <img src="${ogImageUrl}" alt="${job} ${tier} Achievement" class="hero-image" />
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Class</div>
        <div class="stat-value">${job}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Score</div>
        <div class="stat-value">${formatNumber(score)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stage</div>
        <div class="stat-value">Stage ${stage}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Period</div>
        <div class="stat-value">Period ${period}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mode</div>
        <div class="stat-value">${mode === 'paid' ? '🏆 Prize Pool' : '🎮 For Fun'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Achievement</div>
        <div class="stat-value" style="color: ${getTierColor(tier)}">${tier}</div>
      </div>
    </div>
    
    <a href="https://bat-been-379.app.ohara.ai" class="cta-button">
      ⚔️ Play Ether Trials
    </a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
