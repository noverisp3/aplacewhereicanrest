const HTML = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>a place where i can rest</title><script>(function(){document.documentElement.className=localStorage.getItem(\'theme\')||\'light\'})()</script><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="preconnect" href="https://i.ibb.co" crossorigin><link rel="dns-prefetch" href="https://i.ibb.co"><link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#3d3a36"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="I"><link rel="stylesheet" href="/core/style.css"><link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml"></head><body><header><h1 class="title">a place where i can rest</h1><div class="activity-calendar" id="activity-calendar"></div><div class="theme-picker"><button class="theme-toggle" id="theme-toggle" onclick="toggleMenu()"></button><div class="theme-menu" id="theme-menu"><div class="theme-option" data-theme="light" onclick="setTheme(\'light\')"><span class="theme-dot" style="background:#f9f8f6"></span>light</div><div class="theme-option" data-theme="dark" onclick="setTheme(\'dark\')"><span class="theme-dot" style="background:#1a1a1a"></span>dark</div><div class="theme-option" data-theme="sepia" onclick="setTheme(\'sepia\')"><span class="theme-dot" style="background:#f4ecd8"></span>sepia</div><div class="theme-option" data-theme="moon" onclick="setTheme(\'moon\')"><span class="theme-dot" style="background:#1b2838"></span>moon</div><div class="theme-option" data-theme="forest" onclick="setTheme(\'forest\')"><span class="theme-dot" style="background:#2d3b2d"></span>forest</div><div class="theme-option" data-theme="rose" onclick="setTheme(\'rose\')"><span class="theme-dot" style="background:#fdf2f4"></span>rose</div><div class="theme-option" data-theme="minimal" onclick="setTheme(\'minimal\')"><span class="theme-dot" style="background:#fff;border:1px solid #ccc"></span>minimal</div><div class="theme-option" data-theme="typewriter" onclick="setTheme(\'typewriter\')"><span class="theme-dot" style="background:#f5f0e8"></span>typewriter</div><div class="theme-option" data-theme="typewriter-dark" onclick="setTheme(\'typewriter-dark\')"><span class="theme-dot" style="background:#1c1a16"></span>typewriter dark</div></div></div></header><main><section class="write"><textarea id="post-content" placeholder="write something..." class="textarea" rows="4"></textarea><div id="preview"></div><div class="actions"><input type="file" id="image-input" accept="image/*" onchange="selectImage(event)"><button class="btn btn-soft" onclick="document.getElementById(\'image-input\').click()">photo</button><button class="btn" onclick="submitPost()">post</button></div></section><div class="divider"></div><section class="search"><div class="search-row"><input type="text" id="search-input" class="search-input" placeholder="search posts..." oninput="debounceSearch()"></div><div class="search-row search-dates"><input type="date" id="date-from" class="date-input" onchange="searchPosts()"><span class="date-sep">—</span><input type="date" id="date-to" class="date-input" onchange="searchPosts()"><button class="btn-clear" id="clear-search" onclick="clearSearch()" style="display:none">clear</button></div></section><div class="post-count" id="post-count"></div><section class="posts" id="posts-container"></section><div id="scroll-sentinel"></div></main><footer><p class="footer-text"><span id="current-year"></span></p></footer><script src="/core/main.js"></script><div class="lightbox" id="lightbox" onclick="closeLightbox(event)"><div class="lightbox-actions"><button class="lightbox-btn" id="lightbox-download" onclick="downloadLightbox(event)" title="download"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="lightbox-btn" onclick="closeLightbox(event)" title="close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><img class="lightbox-img" id="lightbox-img" src="" alt=""></div><div class="auth-screen" id="auth-screen"><div class="auth-box"><p class="auth-label">enter password</p><input type="password" id="auth-input" class="auth-input" placeholder="..." onkeydown="if(event.key===\'Enter\')doAuth()"><p class="auth-error" id="auth-error"></p><button class="btn" onclick="doAuth()">enter</button></div></div></body></html>';

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function hmacSign(msg, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyToken(token, secret) {
  const sep = token.lastIndexOf('.');
  if (sep === -1) return false;
  const ts = token.substring(0, sep);
  const sig = token.substring(sep + 1);
  const expected = await hmacSign(ts, secret);
  // Timing-safe comparison
  const a = new TextEncoder().encode(sig);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return false;
  const age = Date.now() - parseInt(ts);
  return age >= 0 && age < TOKEN_TTL;
}

function json(data, headers, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const secret = env.SITE_PASSWORD;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-delete-secret',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Login endpoint
    if (path === '/api/auth' && request.method === 'POST') {
      const body = await request.json();
      const pw = body.password || '';

      // Check rate limit
      const attempts = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM failed_attempts WHERE ip = ? AND attempted_at > datetime(\'now\', \'-5 minutes\')'
      ).bind(ip).all();
      const count = attempts.results[0]?.cnt || 0;
      if (count >= 3) {
        return json({ error: 'too many attempts, try again in 5 minutes' }, cors, 429);
      }

      if (pw !== secret) {
        await env.DB.prepare('INSERT INTO failed_attempts (ip) VALUES (?)').bind(ip).run();
        const remaining = 3 - count - 1;
        return json({ error: 'wrong password', remaining }, cors, 401);
      }

      // Clear failed attempts on success
      await env.DB.prepare('DELETE FROM failed_attempts WHERE ip = ?').bind(ip).run();

      // Generate token: timestamp.signature
      const ts = Date.now().toString();
      const sig = await hmacSign(ts, secret);
      const token = ts + '.' + sig;

      return json({ ok: true, token }, cors);
    }

    // Verify token on all other API routes
    if (path.startsWith('/api/') && path !== '/api/img-proxy') {
      const auth = request.headers.get('authorization') || '';
      const token = auth.replace('Bearer ', '');
      if (!token || !(await verifyToken(token, secret))) {
        return json({ error: 'unauthorized' }, cors, 401);
      }
    }

    // API routes
    if (path === '/api/posts' && request.method === 'GET') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
      const cursor = url.searchParams.get('cursor');
      const q = url.searchParams.get('q') || '';
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';

      let where = [];
      let params = [];

      if (q) { where.push('content LIKE ?'); params.push('%' + q + '%'); }
      if (from) { where.push('created_at >= ?'); params.push(from); }
      if (to) { where.push('created_at <= ?'); params.push(to + 'T23:59:59'); }
      if (cursor) { where.push('created_at < (SELECT created_at FROM posts WHERE id = ?)'); params.push(cursor); }

      const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const allParams = [...params, limit + 1];
      const results = await env.DB.prepare('SELECT * FROM posts ' + clause + ' ORDER BY created_at DESC LIMIT ?').bind(...allParams).all();

      const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM posts ' + clause).bind(...params).all();
      const total = countResult.results[0]?.total || 0;

      const hasMore = results.results.length > limit;
      const posts = hasMore ? results.results.slice(0, limit) : results.results;
      return json({ posts, total, nextCursor: hasMore ? posts[posts.length - 1].id : null }, cors);
    }

    if (path === '/api/posts' && request.method === 'POST') {
      const body = await request.json();
      // Content size limit: 10KB text, 5MB image
      if ((body.content || '').length > 10000) {
        return json({ error: 'content too long (max 10KB)' }, cors, 400);
      }
      if ((body.image || '').length > 5000000) {
        return json({ error: 'image too large (max 5MB)' }, cors, 400);
      }
      const id = Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(b => b.toString(36).padStart(2, '0')).join('');
      let date;
      if (body.date) {
        date = body.date;
      } else {
        const now = new Date();
        const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        date = String(vn.getDate()).padStart(2, '0') + '/' + String(vn.getMonth() + 1).padStart(2, '0') + '/' + vn.getFullYear() + ' ' + String(vn.getHours()).padStart(2, '0') + ':' + String(vn.getMinutes()).padStart(2, '0');
      }
      let imageUrl = body.image || '';
      if (imageUrl.startsWith('data:image')) {
        try {
          const base64Data = imageUrl.split(',')[1];
          const form = new FormData();
          form.append('key', env.IMGBB_KEY);
          form.append('image', base64Data);
          const imgRes = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            body: form
          });
          const imgData = await imgRes.json();
          if (imgData.success) imageUrl = imgData.data.url;
        } catch (e) { /* keep base64 if upload fails */ }
      }
      await env.DB.prepare('INSERT INTO posts (id, content, image, date) VALUES (?, ?, ?, ?)').bind(id, body.content || '', imageUrl, date).run();
      return json({ ok: true, id }, cors);
    }

    const del = path.match(/^\/api\/posts\/(.+)$/);
    if (del && request.method === 'DELETE') {
      const secret2 = request.headers.get('x-delete-secret');
      if (secret2 !== env.DELETE_SECRET) {
        return json({ error: 'forbidden' }, cors, 403);
      }
      await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(del[1]).run();
      return json({ ok: true }, cors);
    }

    // Activity heatmap
    if (path === '/api/activity' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        "SELECT date(created_at, '+7 hours') as day, COUNT(*) as count FROM posts GROUP BY day ORDER BY day DESC"
      ).all();
      return json({ activity: results }, cors);
    }

    // Image proxy (cache imgbb images on Cloudflare CDN, rate limited)
    if (path === '/api/img-proxy') {
      const imageUrl = url.searchParams.get('url');
      if (!imageUrl || !imageUrl.startsWith('https://i.ibb.co/')) {
        return new Response('Invalid URL', { status: 400 });
      }
      // Rate limit: 30 requests per minute per IP
      const now = Date.now();
      const key = 'imgproxy:' + ip;
      if (!globalThis._imgProxyRate) globalThis._imgProxyRate = {};
      const reqs = globalThis._imgProxyRate[key] || [];
      const recent = reqs.filter(t => now - t < 60000);
      if (recent.length >= 30) {
        return new Response('Rate limit', { status: 429 });
      }
      recent.push(now);
      globalThis._imgProxyRate[key] = recent;
      const cache = caches.default;
      const cacheKey = new Request(imageUrl, { method: 'GET' });
      let response = await cache.match(cacheKey);
      if (!response) {
        response = await fetch(imageUrl);
        const cloned = response.clone();
        ctx.waitUntil(cache.put(cacheKey, new Response(cloned.body, {
          status: cloned.status,
          headers: {
            'Content-Type': cloned.headers.get('Content-Type') || 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        })));
      }
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // RSS Feed
    if (path === '/feed.xml' || path === '/rss.xml') {
      const { results } = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50').all();
      const siteUrl = url.origin;
      const items = results.map(p => {
        const date = p.created_at ? new Date(p.created_at + 'Z').toUTCString() : '';
        const desc = p.content ? '<p>' + p.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>' : '';
        const img = p.image ? '<img src="' + p.image.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" style="max-width:600px">' : '';
        return `<item><title>${p.date}</title><pubDate>${date}</pubDate><guid>${siteUrl}#post-${p.id}</guid><description><![CDATA[${img}${desc}]]></description></item>`;
      }).join('');
      const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>a place where i can rest</title><link>${siteUrl}</link><description>my daily journal</description><language>vi</language>${items}</channel></rss>`;
      return new Response(rss, { headers: { 'Content-Type': 'application/rss+xml', 'Cache-Control': 'public, max-age=3600' } });
    }

    // Static files
    if (path === '/' || path === '/index.html') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }

    if (path === '/manifest.json') {
      const mf = '{"name":"I","short_name":"I","description":"a place where i can rest","start_url":"/","display":"standalone","background_color":"#f9f8f6","theme_color":"#3d3a36","icons":[{"src":"/assets/favicon.svg","sizes":"any","type":"image/svg+xml"}]}';
      return new Response(mf, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
    }

    if (path === '/service-worker.js') {
      const sw = await env.ASSETS.fetch(request);
      return new Response(sw.body, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' } });
    }

    if (path === '/core/style.css') {
      const css = await env.ASSETS.fetch(request);
      return new Response(css.body, { headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (path === '/core/main.js') {
      const js = await env.ASSETS.fetch(request);
      return new Response(js.body, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (path === '/assets/favicon.svg') {
      const favicon = await env.ASSETS.fetch(request);
      return new Response(favicon.body, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};