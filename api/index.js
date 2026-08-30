const HTML = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>a place where i can rest</title><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/core/style.css"></head><body><header><h1 class="title">a place where i can rest</h1><div class="theme-picker"><button class="theme-toggle" id="theme-toggle" onclick="toggleMenu()"></button><div class="theme-menu" id="theme-menu"><div class="theme-option" data-theme="light" onclick="setTheme(\'light\')"><span class="theme-dot" style="background:#f9f8f6"></span>light</div><div class="theme-option" data-theme="dark" onclick="setTheme(\'dark\')"><span class="theme-dot" style="background:#1a1a1a"></span>dark</div><div class="theme-option" data-theme="sepia" onclick="setTheme(\'sepia\')"><span class="theme-dot" style="background:#f4ecd8"></span>sepia</div><div class="theme-option" data-theme="moon" onclick="setTheme(\'moon\')"><span class="theme-dot" style="background:#1b2838"></span>moon</div></div></div></header><main><section class="write"><textarea id="post-content" placeholder="write something..." class="textarea" rows="4"></textarea><div id="preview"></div><div class="actions"><input type="file" id="image-input" accept="image/*" onchange="selectImage(event)"><button class="btn btn-soft" onclick="document.getElementById(\'image-input\').click()">photo</button><button class="btn" onclick="submitPost()">post</button></div></section><div class="divider"></div><section class="search"><div class="search-row"><input type="text" id="search-input" class="search-input" placeholder="search posts..." oninput="debounceSearch()"></div><div class="search-row search-dates"><input type="date" id="date-from" class="date-input" onchange="searchPosts()"><span class="date-sep">—</span><input type="date" id="date-to" class="date-input" onchange="searchPosts()"><button class="btn-clear" id="clear-search" onclick="clearSearch()" style="display:none">clear</button></div></section><div class="post-count" id="post-count"></div><section class="posts" id="posts-container"></section><div id="scroll-sentinel"></div></main><footer><p class="footer-text"><span id="current-year"></span></p></footer><script src="/core/main.js"></script><div class="lightbox" id="lightbox" onclick="closeLightbox(event)"><div class="lightbox-actions"><button class="lightbox-btn" id="lightbox-download" onclick="downloadLightbox(event)">↓</button><button class="lightbox-btn" onclick="closeLightbox(event)">x</button></div><img class="lightbox-img" id="lightbox-img" src="" alt=""></div></body></html>';

const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f9f8f6"/><text x="16" y="20" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#3d3a36">I</text></svg>';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // API routes
    if (path === '/api/posts' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const cursor = url.searchParams.get('cursor');
      const q = url.searchParams.get('q') || '';
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';

      let where = [];
      let params = [];

      if (q) {
        where.push('content LIKE ?');
        params.push('%' + q + '%');
      }
      if (from) {
        where.push('created_at >= ?');
        params.push(from);
      }
      if (to) {
        where.push('created_at <= ?');
        params.push(to + 'T23:59:59');
      }
      if (cursor) {
        where.push('created_at < (SELECT created_at FROM posts WHERE id = ?)');
        params.push(cursor);
      }

      const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const allParams = [...params, limit + 1];
      const stmt = 'SELECT * FROM posts ' + clause + ' ORDER BY created_at DESC LIMIT ?';
      const results = await env.DB.prepare(stmt).bind(...allParams).all();

      const countParams = params.slice();
      const countStmt = 'SELECT COUNT(*) as total FROM posts ' + clause;
      const countResult = await env.DB.prepare(countStmt).bind(...countParams).all();
      const total = countResult.results[0]?.total || 0;

      const hasMore = results.results.length > limit;
      const posts = hasMore ? results.results.slice(0, limit) : results.results;
      return json({ posts, total, nextCursor: hasMore ? posts[posts.length - 1].id : null }, cors);
    }

    if (path === '/api/posts' && request.method === 'POST') {
      const body = await request.json();
      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const date = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      await env.DB.prepare('INSERT INTO posts (id, content, image, date) VALUES (?, ?, ?, ?)').bind(id, body.content || '', body.image || '', date).run();
      return json({ ok: true, id }, cors);
    }

    const del = path.match(/^\/api\/posts\/(.+)$/);
    if (del && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(del[1]).run();
      return json({ ok: true }, cors);
    }

    // Static files
    if (path === '/' || path === '/index.html') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
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
      return new Response(FAVICON, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
    }

    return new Response('Not Found', { status: 404 });
  }
};

function json(data, headers, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}