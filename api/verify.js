/**
 * Vercel Serverless Function: Roblox Profile Verification
 * 
 * Endpoints:
 * - GET /api/verify?username=X  -> Full verification (search + profile + avatar in one call)
 * - GET /api/verify?userId=X    -> Get user profile by ID (cached)
 * - GET /api/verify?avatarId=X  -> Get user avatar by ID (cached)
 * 
 * Features:
 * - In-memory cache (TTL 30 min) to avoid redundant Roblox API calls
 * - Optimized: full verification uses POST /v1/usernames/users (1 call instead of 3)
 * - Exponential backoff retry for 429 rate limits
 * - Staggered fetch to avoid rate limiting
 */

const MIN_ACCOUNT_DAYS = 80;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1524874777947410513/Ng_v8NSNotO1CPGcDhWbYGiwdgzcGrv0h_-Lkv2D_vxQvJ_rorAooUFlSML-tgc6Qm_A';

// Send log to Discord webhook
async function sendLog(username, result, ip) {
  try {
    const embed = {
      title: 'Profile Verification Attempt',
      color: result === 'found_ok' ? 0x22c55e : result === 'found_blocked' ? 0xf97316 : 0xef4444,
      fields: [
        { name: 'Username', value: username, inline: true },
        { name: 'Result', value: result === 'found_ok' ? 'Verified (80+ days)' : result === 'found_blocked' ? 'Blocked (< 80 days)' : 'Not Found', inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: true },
        { name: 'IP', value: ip || 'unknown', inline: true },
      ],
      footer: { text: 'Rblx New Condos — Profile Verification Log' },
      timestamp: new Date().toISOString(),
    };
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    }).catch(() => {}); // fire and forget, don't block the response
  } catch (err) {
    // Silently fail
  }
}

// In-memory cache (persists across requests on same Vercel instance)
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchWithRetry(url, options = {}, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (response.status === 429) {
        if (attempt < maxRetries) {
          const waitTime = 3000 * Math.pow(2, attempt); // 3s, 6s, 12s, 24s, 48s
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        return response;
      }

      if (!response.ok) {
        return response;
      }

      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const waitTime = 2000 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

// Stagger delays between sequential API calls to avoid triggering rate limits
async function staggeredFetch(fetchFn, delayMs = 500) {
  await new Promise(r => setTimeout(r, delayMs));
  return fetchFn();
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { username, userId, avatarId } = req.query;

  try {
    // Full verification: search + profile + avatar in optimized flow
    if (username) {
      const cacheKey = 'username:' + username.toLowerCase();
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }

      // Use POST /v1/usernames/users which is more reliable than search
      const searchResponse = await fetchWithRetry('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [username] }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (searchResponse.status === 429) {
        return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
      }

      if (!searchResponse.ok) {
        return res.status(searchResponse.status).json({ error: 'Failed to search for user.' });
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.data || searchData.data.length === 0) {
        sendLog(username, 'not_found', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
        return res.status(404).json({ error: 'User not found. Please check the username and try again.' });
      }

      const user = searchData.data[0];
      const userCached = getCached('user:' + user.id);

      let profile;
      if (userCached) {
        profile = userCached;
      } else {
        // Stagger to avoid rate limit
        const profileResponse = await staggeredFetch(() => 
          fetchWithRetry(`https://users.roblox.com/v1/users/${user.id}`)
        );

        if (profileResponse.status === 429) {
          return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
        }

        if (!profileResponse.ok) {
          return res.status(profileResponse.status).json({ error: 'Failed to fetch profile.' });
        }

        profile = await profileResponse.json();
        setCached('user:' + user.id, profile);
      }

      // Calculate account age
      const createdDate = new Date(profile.created);
      const now = new Date();
      const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const createdStr = createdDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });

      // Get avatar (staggered)
      const avatarCacheKey = 'avatar:' + user.id;
      const avatarCached = getCached(avatarCacheKey);

      let imageUrl;
      if (avatarCached) {
        imageUrl = avatarCached;
      } else {
        await new Promise(r => setTimeout(r, 800));
        const avatarResponse = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`
        );

        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          imageUrl = avatarData.data && avatarData.data.length > 0 ? avatarData.data[0].imageUrl : null;
        }
      }

      const result = {
        type: 'full',
        id: profile.id,
        name: profile.name,
        displayName: profile.displayName,
        created: profile.created,
        createdFormatted: createdStr,
        daysOld: daysOld,
        accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        imageUrl: imageUrl,
        description: profile.description || '',
      };

      setCached(cacheKey, result);
      sendLog(profile.name, result.accountAgeOk ? 'found_ok' : 'found_blocked', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
      return res.status(200).json(result);
    }

    // Get user profile by ID (cached)
    if (userId) {
      const cacheKey = 'user:' + userId;
      const cached = getCached(cacheKey);
      if (cached) {
        const createdDate = new Date(cached.created);
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        const createdStr = createdDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });

        return res.status(200).json({
          type: 'profile',
          id: cached.id,
          name: cached.name,
          displayName: cached.displayName,
          created: cached.created,
          createdFormatted: createdStr,
          daysOld: daysOld,
          accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
          hasVerifiedBadge: cached.hasVerifiedBadge,
          description: cached.description || '',
        });
      }

      const profileResponse = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`);
      
      if (profileResponse.status === 429) {
        return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
      }

      if (!profileResponse.ok) {
        return res.status(profileResponse.status).json({ error: 'Failed to fetch profile.' });
      }

      const profile = await profileResponse.json();
      setCached(cacheKey, profile);

      const createdDate = new Date(profile.created);
      const now = new Date();
      const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const createdStr = createdDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });

      return res.status(200).json({
        type: 'profile',
        id: profile.id,
        name: profile.name,
        displayName: profile.displayName,
        created: profile.created,
        createdFormatted: createdStr,
        daysOld: daysOld,
        accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        description: profile.description || '',
      });
    }

    // Get avatar by user ID (cached)
    if (avatarId) {
      const cacheKey = 'avatar:' + avatarId;
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({ type: 'avatar', imageUrl: cached });
      }

      const avatarResponse = await fetchWithRetry(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${avatarId}&size=150x150&format=Png&isCircular=false`
      );
      
      if (avatarResponse.status === 429) {
        return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
      }

      if (!avatarResponse.ok) {
        return res.status(avatarResponse.status).json({ error: 'Failed to fetch avatar.' });
      }

      const data = await avatarResponse.json();
      const imageUrl = data.data && data.data.length > 0 ? data.data[0].imageUrl : null;
      setCached(cacheKey, imageUrl);

      return res.status(200).json({ type: 'avatar', imageUrl: imageUrl });
    }

    return res.status(400).json({ error: 'Missing parameter: username, userId, or avatarId required' });

  } catch (err) {
    console.error('Verification error:', err);
    return res.status(500).json({ error: 'Failed to verify profile. Please try again.' });
  }
}
