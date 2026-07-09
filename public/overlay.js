(function () {
  'use strict';

  var LANG_KEY = 'rc2_lang';
  var PROFILE_KEY = 'rc_verified_profile';
  var MIN_ACCOUNT_DAYS = 80;

  /* ── Sound ─────────────────────────────────────────────── */
  var audio = null;
  function playClick() {
    try {
      if (!audio) {
        audio = new Audio('/click-sound.mp3');
        audio.volume = 0.5;
      }
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

  /* ── MutationObserver ─────────────────────────────────── */
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
     ROBLOX PROFILE VERIFICATION SYSTEM
     ══════════════════════════════════════════════════════════ */

  /* ── API helpers (via /api/verify serverless function) ─── */
  function apiVerify(params) {
    var queryParts = [];
    for (var key in params) {
      queryParts.push(key + '=' + encodeURIComponent(params[key]));
    }
    var url = '/api/verify?' + queryParts.join('&');
    return fetch(url)
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (d) { throw new Error(d.error || 'Server error'); });
        }
        return r.json();
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
      '<input type="text" class="rc-profile-input" id="rc-username-input" placeholder="Enter your Roblox username..." autocomplete="off" spellcheck="false">' +
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

    // Step 1: Search for user by username
    apiVerify({ username: username })
      .then(function (searchResult) {
        var userId = searchResult.id;
        // Step 2: Get profile by user ID
        return apiVerify({ userId: userId }).then(function (profile) {
          return { profile: profile, userId: userId };
        });
      })
      .then(function (data) {
        // Step 3: Get avatar
        return apiVerify({ avatarId: data.userId }).then(function (avatar) {
          return { profile: data.profile, avatarUrl: avatar.imageUrl };
        });
      })
      .then(function (data) {
        loader.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Verify Profile';

        var profile = data.profile;
        var daysEl = document.getElementById('rc-days-old');
        daysEl.textContent = profile.daysOld;
        daysEl.className = 'rc-stat-value ' + (profile.accountAgeOk ? 'rc-profile-age-ok' : 'rc-profile-age-bad');

        var formEl = document.getElementById('rc-verify-form');
        var displayEl = document.getElementById('rc-profile-display');
        formEl.style.display = 'none';
        displayEl.style.display = 'block';

        document.getElementById('rc-avatar').src = data.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a0a0a"/><text x="50" y="60" text-anchor="middle" fill="%23ef4444" font-size="40">?</text></svg>';
        document.getElementById('rc-display-name').textContent = profile.name;
        document.getElementById('rc-user-id').textContent = 'ID: ' + profile.id;
        document.getElementById('rc-created').textContent = profile.createdFormatted;

        var actions = document.getElementById('rc-actions');
        var blocked = document.getElementById('rc-blocked');

        if (profile.accountAgeOk) {
          blocked.style.display = 'none';
          actions.style.display = 'flex';
          actions.innerHTML = '<button class="rc-btn-primary" onclick="__rcEnterSite()">Enter Site</button><button class="rc-btn-secondary" onclick="__rcCancelProfile()">Cancel</button>';
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
        error.textContent = err.message || 'Failed to verify profile. Please try again.';
      });
  };

  /* ── Enter site ────────────────────────────────────────── */
  window.__rcEnterSite = function () {
    var overlay = document.getElementById('rc-profile-overlay');
    if (overlay) { overlay.style.animation = 'rc-fadeout .3s ease forwards'; setTimeout(function () { overlay.remove(); }, 310); }
    sessionStorage.setItem(PROFILE_KEY, 'verified');
  };

  /* ── Cancel ────────────────────────────────────────────── */
  window.__rcCancelProfile = function () {
    var overlay = document.getElementById('rc-profile-overlay');
    if (overlay) { overlay.style.animation = 'rc-fadeout .3s ease forwards'; setTimeout(function () { overlay.remove(); }, 310); }
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
  if (!isVerified()) { showProfileVerification(); }

  /* ── MutationObserver ──────────────────────────────────── */
  observer.observe(document.body, { childList: true, subtree: true });
})();
