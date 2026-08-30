const HTML = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>a place where i can rest</title><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/core/style.css"></head><body><header><h1 class="title">a place where i can rest</h1><button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()"></button></header><main><section class="write"><textarea id="post-content" placeholder="write something..." class="textarea" rows="4"></textarea><div id="preview"></div><div class="actions"><input type="file" id="image-input" accept="image/*" onchange="selectImage(event)"><button class="btn btn-soft" onclick="document.getElementById(\'image-input\').click()">photo</button><button class="btn" onclick="submitPost()">post</button></div></section><div class="divider"></div><section class="posts" id="posts-container"></section><div id="scroll-sentinel"></div></main><footer><p class="footer-text"><span id="current-year"></span></p></footer><script src="/core/main.js"></script></body></html>';

const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f9f8f6"/><text x="16" y="22" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#3d3a36">I</text></svg>';

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
      let results;
      if (cursor) {
        results = await env.DB.prepare('SELECT * FROM posts WHERE created_at < (SELECT created_at FROM posts WHERE id = ?) ORDER BY created_at DESC LIMIT ?').bind(cursor, limit + 1).all();
      } else {
        results = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ?').bind(limit + 1).all();
      }
      const hasMore = results.results.length > limit;
      const posts = hasMore ? results.results.slice(0, limit) : results.results;
      return json({ posts, nextCursor: hasMore ? posts[posts.length - 1].id : null }, cors);
    }

    if (path === '/api/posts' && request.method === 'POST') {
      const body = await request.json();
      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const date = new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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