/**
 * Vercel Serverless Function: Roblox Profile Verification
 *
 * Endpoints:
 * - GET /api/verify?username=X  -> Full verification (search + profile + avatar)
 * - GET /api/verify?userId=X    -> Get user profile by ID (cached)
 * - GET /api/verify?avatarId=X  -> Get user avatar by ID (cached)
 */

const MIN_ACCOUNT_DAYS = 80;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1524874777947410513/Ng_v8NSNotO1CPGcDhWbYGiwdgzcGrv0h_-Lkv2D_vxQvJ_rorAooUFlSML-tgc6Qm_A';

// ── Parse User-Agent into human-readable info ──────────────────────────────
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };

  let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

  // Browser
  if (/Firefox\/([\d.]+)/.test(ua)) {
    browser = 'Firefox ' + ua.match(/Firefox\/([\d.]+)/)[1];
  } else if (/Edg\/([\d.]+)/.test(ua)) {
    browser = 'Edge ' + ua.match(/Edg\/([\d.]+)/)[1];
  } else if (/OPR\/([\d.]+)/.test(ua)) {
    browser = 'Opera ' + ua.match(/OPR\/([\d.]+)/)[1];
  } else if (/Chrome\/([\d.]+)/.test(ua)) {
    browser = 'Chrome ' + ua.match(/Chrome\/([\d.]+)/)[1];
  } else if (/Version\/([\d.]+).*Safari/.test(ua)) {
    browser = 'Safari ' + ua.match(/Version\/([\d.]+)/)[1];
  } else if (/Safari\//.test(ua)) {
    browser = 'Safari';
  }

  // OS / Device
  if (/iPhone/.test(ua)) {
    const v = ua.match(/iPhone OS ([\d_]+)/);
    os = 'iOS ' + (v ? v[1].replace(/_/g, '.') : '');
    device = '📱 iPhone';
  } else if (/iPad/.test(ua)) {
    const v = ua.match(/OS ([\d_]+)/);
    os = 'iPadOS ' + (v ? v[1].replace(/_/g, '.') : '');
    device = '📱 iPad';
  } else if (/Android/.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/);
    os = 'Android ' + (v ? v[1] : '');
    const model = ua.match(/;\s*([^;)]+)\s*Build\//);
    device = '📱 ' + (model ? model[1].trim() : 'Android');
  } else if (/Windows NT/.test(ua)) {
    const v = ua.match(/Windows NT ([\d.]+)/);
    const map = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' };
    os = 'Windows ' + (v ? (map[v[1]] || v[1]) : '');
    device = '🖥️ Desktop';
  } else if (/Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_]+)/);
    os = 'macOS ' + (v ? v[1].replace(/_/g, '.') : '');
    device = '🖥️ Mac';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
    device = '🖥️ Desktop';
  }

  return { browser, os, device };
}

// ── Country flag emoji from ISO code ──────────────────────────────────────
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + 127397));
  } catch { return ''; }
}

// ── Geo lookup by IP ──────────────────────────────────────────────────────
async function getGeoInfo(ip) {
  try {
    const clean = (ip || '').split(',')[0].trim();
    if (!clean || clean === 'unknown' || clean.startsWith('127.') || clean.startsWith('::1')) return null;
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(clean)}/json/`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch { return null; }
}

// ── Send webhook log (fire and forget — call without await) ───────────────
async function sendLog(data) {
  const isError = data.lookupType === 'error';
  const statusEmoji = isError ? '⚠️' : data.accountAgeOk ? '✅' : data.found ? '🚫' : '❌';
  const statusText = isError
    ? 'Server Error'
    : data.accountAgeOk ? 'Verified (80+ days)'
    : data.found ? 'Blocked (< 80 days)'
    : 'Not Found';
  const color = isError ? 0x6b7280 : data.accountAgeOk ? 0x22c55e : data.found ? 0xf97316 : 0xef4444;

  const fields = [];

  // Status + Roblox info
  fields.push({ name: 'Status', value: `${statusEmoji} **${statusText}**`, inline: true });
  fields.push({ name: 'Username', value: data.username || 'unknown', inline: true });
  if (data.displayName && data.displayName !== data.username) {
    fields.push({ name: 'Display Name', value: data.displayName, inline: true });
  }
  if (data.userId) {
    fields.push({ name: 'User ID', value: `[${data.userId}](https://www.roblox.com/users/${data.userId}/profile)`, inline: true });
  }
  if (data.daysOld !== undefined) {
    fields.push({ name: 'Account Age', value: `${data.daysOld} days`, inline: true });
  }
  if (data.createdFormatted) {
    fields.push({ name: 'Created', value: data.createdFormatted, inline: true });
  }
  if (data.hasVerifiedBadge !== undefined) {
    fields.push({ name: 'Verified Badge', value: data.hasVerifiedBadge ? 'Yes ✅' : 'No', inline: true });
  }
  if (isError && data.error) {
    fields.push({ name: 'Error', value: `\`${String(data.error).substring(0, 100)}\``, inline: false });
  }

  // Separator
  fields.push({ name: '\u200b', value: '\u200b', inline: false });

  // Browser / device info
  const { browser, os, device } = parseUserAgent(data.userAgent);
  fields.push({ name: '🌐 Browser', value: browser, inline: true });
  fields.push({ name: '💻 OS', value: os, inline: true });
  fields.push({ name: '📱 Device', value: device, inline: true });

  // Geo + IP
  const geo = await getGeoInfo(data.ip);
  if (geo) {
    const flag = countryFlag(geo.country_code);
    const location = [flag, geo.city, geo.region, geo.country_name].filter(Boolean).join(', ');
    fields.push({ name: '📍 Location', value: location || 'Unknown', inline: true });
    fields.push({ name: '🌐 IP', value: `\`${geo.ip}\``, inline: true });
    if (geo.org) fields.push({ name: '🏢 ISP', value: geo.org.substring(0, 50), inline: true });
  } else {
    const rawIp = (data.ip || 'unknown').split(',')[0].trim();
    fields.push({ name: '🌐 IP', value: `\`${rawIp}\``, inline: true });
  }

  // Source + time
  if (data.referer && data.referer !== 'direct') {
    fields.push({ name: '🔗 Source', value: data.referer.substring(0, 100), inline: true });
  }
  fields.push({ name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });

  const embed = {
    title: '🔍 Profile Verification',
    color,
    fields,
    footer: { text: 'Rblx New Condos — Verification Log' },
    timestamp: new Date().toISOString(),
  };

  // Send with sequential retry (max 3 attempts)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after') || '2';
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000 + 300));
        continue;
      }
      if (res.ok) return true;
      // Non-retryable Discord error (e.g. 400 malformed) — stop retrying
      break;
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return false;
}

// ── In-memory cache ──────────────────────────────────────────────────────
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ── Fetch with exponential backoff ────────────────────────────────────────
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          ...options.headers,
        },
      });
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
          continue;
        }
        return res;
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1500 * Math.pow(2, attempt)));
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { username, userId, avatarId } = req.query;

  const clientInfo = {
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    referer: req.headers['referer'] || req.headers['origin'] || 'direct',
  };

  try {
    // ── Username verification ──────────────────────────────────────────
    if (username) {
      const cacheKey = 'username:' + username.toLowerCase();
      const cached = getCached(cacheKey);

      if (cached) {
        // Respond first, then log in background
        res.status(200).json(cached);
        sendLog({ ...clientInfo, username: cached.name || username, displayName: cached.displayName, userId: cached.id, daysOld: cached.daysOld, createdFormatted: cached.createdFormatted, accountAgeOk: cached.accountAgeOk, hasVerifiedBadge: cached.hasVerifiedBadge, found: true });
        return;
      }

      // Search username
      const searchRes = await fetchWithRetry('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [username] }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (searchRes.status === 429) {
        res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
        sendLog({ ...clientInfo, username, found: false, accountAgeOk: false, lookupType: 'rate-limited' });
        return;
      }
      if (!searchRes.ok) {
        res.status(searchRes.status).json({ error: 'Failed to search for user.' });
        return;
      }

      const searchData = await searchRes.json();

      if (!searchData.data || searchData.data.length === 0) {
        res.status(404).json({ error: 'User not found. Please check the username and try again.' });
        sendLog({ ...clientInfo, username, found: false, accountAgeOk: false });
        return;
      }

      const user = searchData.data[0];

      // Fetch profile
      let profile = getCached('user:' + user.id);
      if (!profile) {
        const profileRes = await fetchWithRetry(`https://users.roblox.com/v1/users/${user.id}`);
        if (profileRes.status === 429) {
          res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
          sendLog({ ...clientInfo, username, found: false, accountAgeOk: false, lookupType: 'rate-limited' });
          return;
        }
        if (!profileRes.ok) { res.status(profileRes.status).json({ error: 'Failed to fetch profile.' }); return; }
        profile = await profileRes.json();
        setCached('user:' + user.id, profile);
      }

      const createdDate = new Date(profile.created);
      const daysOld = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
      const createdFormatted = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Fetch avatar (best-effort)
      let imageUrl = getCached('avatar:' + user.id);
      if (!imageUrl) {
        try {
          const avatarRes = await fetchWithRetry(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`
          );
          if (avatarRes && avatarRes.ok) {
            const avatarData = await avatarRes.json();
            imageUrl = avatarData.data?.[0]?.imageUrl || null;
            if (imageUrl) setCached('avatar:' + user.id, imageUrl);
          }
        } catch { /* avatar is non-critical */ }
      }

      const result = {
        type: 'full',
        id: profile.id,
        name: profile.name,
        displayName: profile.displayName,
        created: profile.created,
        createdFormatted,
        daysOld,
        accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        imageUrl: imageUrl || null,
        description: profile.description || '',
      };
      setCached(cacheKey, result);

      // Respond immediately, log in background
      res.status(200).json(result);
      sendLog({
        ...clientInfo,
        username: profile.name,
        displayName: profile.displayName,
        userId: profile.id,
        daysOld,
        createdFormatted,
        accountAgeOk: result.accountAgeOk,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        found: true,
      });
      return;
    }

    // ── Profile by userId ──────────────────────────────────────────────
    if (userId) {
      const cacheKey = 'user:' + userId;
      let profile = getCached(cacheKey);

      if (!profile) {
        const profileRes = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`);
        if (profileRes.status === 429) { return res.status(429).json({ error: 'Roblox API rate-limited. Please wait.' }); }
        if (!profileRes.ok) { return res.status(profileRes.status).json({ error: 'Failed to fetch profile.' }); }
        profile = await profileRes.json();
        setCached(cacheKey, profile);
      }

      const createdDate = new Date(profile.created);
      const daysOld = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
      const createdFormatted = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const payload = {
        type: 'profile',
        id: profile.id,
        name: profile.name,
        displayName: profile.displayName,
        created: profile.created,
        createdFormatted,
        daysOld,
        accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        description: profile.description || '',
      };

      res.status(200).json(payload);
      sendLog({ ...clientInfo, username: profile.name, displayName: profile.displayName, userId: profile.id, daysOld, createdFormatted, accountAgeOk: payload.accountAgeOk, hasVerifiedBadge: profile.hasVerifiedBadge, found: true, lookupType: 'userId' });
      return;
    }

    // ── Avatar by userId ───────────────────────────────────────────────
    if (avatarId) {
      const cacheKey = 'avatar:' + avatarId;
      let imageUrl = getCached(cacheKey);

      if (!imageUrl) {
        const avatarRes = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${avatarId}&size=150x150&format=Png&isCircular=false`
        );
        if (avatarRes.status === 429) { return res.status(429).json({ error: 'Roblox API rate-limited. Please wait.' }); }
        if (!avatarRes.ok) { return res.status(avatarRes.status).json({ error: 'Failed to fetch avatar.' }); }
        const data = await avatarRes.json();
        imageUrl = data.data?.[0]?.imageUrl || null;
        if (imageUrl) setCached(cacheKey, imageUrl);
      }

      return res.status(200).json({ type: 'avatar', imageUrl });
    }

    return res.status(400).json({ error: 'Missing parameter: username, userId, or avatarId required' });

  } catch (err) {
    sendLog({ ...clientInfo, username: username || userId || 'unknown', found: false, accountAgeOk: false, error: err.message, lookupType: 'error' });
    return res.status(500).json({ error: 'Failed to verify profile. Please try again.' });
  }
};
