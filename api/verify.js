/**
 * Vercel Serverless Function: Roblox Profile Verification
 * 
 * Endpoints:
 * - GET /api/verify?username=X  -> Search for user by username
 * - GET /api/verify?userId=X    -> Get user profile by ID
 * - GET /api/verify?avatarId=X  -> Get user avatar by ID
 * 
 * All endpoints proxy to Roblox API server-side (no CORS issues).
 * Includes retry logic for rate limiting.
 */

const MIN_ACCOUNT_DAYS = 80;

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...options.headers,
        },
      });

      if (response.status === 429 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

module.exports = async function(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { username, userId, avatarId } = req.query;

  try {
    // Search for user by username
    if (username) {
      const searchUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=10`;
      const response = await fetchWithRetry(searchUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Roblox API returned ${response.status}` });
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return res.status(404).json({ error: 'User not found. Please check the username and try again.' });
      }

      // Try exact match first
      const exactMatch = data.data.find(u => u.name.toLowerCase() === username.toLowerCase());
      const result = exactMatch || data.data[0];

      return res.status(200).json({
        type: 'search',
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        hasVerifiedBadge: result.hasVerifiedBadge,
      });
    }

    // Get user profile by ID
    if (userId) {
      const profileUrl = `https://users.roblox.com/v1/users/${userId}`;
      const response = await fetchWithRetry(profileUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Roblox API returned ${response.status}` });
      }

      const profile = await response.json();

      // Calculate account age
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

    // Get avatar by user ID
    if (avatarId) {
      const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${avatarId}&size=150x150&format=Png&isCircular=false`;
      const response = await fetchWithRetry(avatarUrl);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Roblox API returned ${response.status}` });
      }

      const data = await response.json();
      const imageUrl = data.data && data.data.length > 0 ? data.data[0].imageUrl : null;

      return res.status(200).json({
        type: 'avatar',
        imageUrl: imageUrl,
      });
    }

    // No valid parameters
    return res.status(400).json({ error: 'Missing parameter: username, userId, or avatarId required' });

  } catch (err) {
    console.error('Verification error:', err);
    return res.status(500).json({ error: 'Failed to verify profile. Please try again.' });
  }
}
