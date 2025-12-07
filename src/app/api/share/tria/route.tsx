import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

// TRIA background image (with transparency)
const TRIA_BACKGROUND = 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/8dca14ea-929f-4e7f-8c24-ac489c310079-2UjW4amfBGGmGM2rGA0MSh9C1mlgz1';

// Format number with commas (no decimals)
function formatNumber(num: number): string {
  return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  
  // Check if this is OG image request
  const isOgImage = searchParams.get('og') === 'true';
  
  const triaStr = searchParams.get('tria') || '0';
  const tria = parseFloat(triaStr) || 0;
  const periods = searchParams.get('periods') || '1';
  const pfpUrl = searchParams.get('pfp') || '';
  const username = searchParams.get('username') || 'Anonymous';
  
  // Generate OG Image with ImageResponse
  if (isOgImage) {
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
          {/* Background TRIA Image with transparency */}
          <img
            src={TRIA_BACKGROUND}
            alt="TRIA Background"
            style={{
              width: '900px',
              height: '600px',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: 0.4,
            }}
          />
          
          {/* Dark overlay for better text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8))',
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
            {/* Top Section - Game Title */}
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
                  fontSize: '36px',
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
                      fontSize: '20px',
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
            
            {/* Middle Section - TRIA Amount */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#10B981',
                  textShadow: '0 0 30px #10B981, 0 4px 12px rgba(0,0,0,0.9)',
                  display: 'flex',
                  letterSpacing: '2px',
                }}
              >
                🏆 REWARDS CLAIMED 🏆
              </div>
              
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: '#FBBF24',
                  textShadow: '0 0 40px #FBBF24, 0 4px 16px rgba(0,0,0,0.9)',
                  display: 'flex',
                  letterSpacing: '4px',
                }}
              >
                {formatNumber(tria)}
              </div>
              
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#FFF',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  display: 'flex',
                }}
              >
                TRIA TOKENS
              </div>
            </div>
            
            {/* Bottom Section - Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '24px',
                borderRadius: '16px',
                border: '2px solid rgba(16, 185, 129, 0.5)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: '22px',
                  color: '#FFF',
                }}
              >
                <span style={{ color: '#10B981', fontWeight: 'bold' }}>
                  Claimed from {periods} period{parseInt(periods) > 1 ? 's' : ''}
                </span>
              </div>
              
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: '#9CA3AF',
                }}
              >
                Play to earn more TRIA on Base! 🎮
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
  const ogImageUrl = `${request.nextUrl.origin}/api/share/tria?og=true&tria=${tria}&periods=${periods}&pfp=${encodeURIComponent(pfpUrl)}&username=${encodeURIComponent(username)}`;
  
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
  <title>Ether Trials - TRIA Claimed!</title>
  
  <!-- Mini App Embed Metadata -->
  <meta name="fc:miniapp" content='${JSON.stringify(embedData)}' />
  <meta name="fc:frame" content='${JSON.stringify(embedData)}' />
  
  <!-- Standard OpenGraph -->
  <meta property="og:title" content="Ether Trials - ${formatNumber(tria)} TRIA Claimed!" />
  <meta property="og:description" content="Just claimed ${formatNumber(tria)} TRIA from ${periods} period${parseInt(periods) > 1 ? 's' : ''}! Play to earn on Base!" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="900" />
  <meta property="og:image:height" content="600" />
  <meta property="og:url" content="${request.nextUrl.toString()}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Ether Trials - TRIA Claimed!" />
  <meta name="twitter:description" content="${formatNumber(tria)} TRIA claimed from ${periods} period${parseInt(periods) > 1 ? 's' : ''}!" />
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
      border: 3px solid #10b981;
      margin: 2rem auto;
      display: block;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }
    .title {
      font-size: 2rem;
      font-weight: bold;
      background: linear-gradient(to right, #fbbf24, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }
    .amount {
      font-size: 3rem;
      font-weight: bold;
      color: #fbbf24;
      text-shadow: 0 0 30px #fbbf24;
      margin: 1rem 0;
    }
    .info {
      font-size: 1.5rem;
      color: #10b981;
      margin: 1rem 0;
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
    <div class="info">🏆 REWARDS CLAIMED 🏆</div>
    
    <img src="${ogImageUrl}" alt="TRIA Claimed" class="hero-image" />
    
    <div class="amount">${formatNumber(tria)} TRIA</div>
    <div class="info">From ${periods} period${parseInt(periods) > 1 ? 's' : ''}</div>
    
    <a href="https://bat-been-379.app.ohara.ai" class="cta-button">
      ⚔️ Play to Earn More
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
