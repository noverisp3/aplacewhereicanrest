const API = '';

// theme
function applyTheme() {
  const dark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark', dark);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? 'o' : 'x';
}

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? 'o' : 'x';
}

// pending image
let pendingImage = null;

// render
async function renderPosts() {
  const c = document.getElementById('posts-container');
  if (!c) return;
  try {
    const res = await fetch(API + '/api/posts');
    const posts = await res.json();
    if (!posts.length) {
      c.innerHTML = '<p class="empty">nothing here yet.</p>';
      return;
    }
    c.innerHTML = posts.map(p => {
      const img = p.image ? `<img src="${p.image}" class="post-image" alt="">` : '';
      const txt = p.content ? `<div class="post-body">${esc(p.content)}</div>` : '';
      return `
      <div class="post">
        ${img}
        ${txt}
        <div class="post-footer">
          <span class="post-date">${p.date}</span>
          <button class="post-delete" onclick="deletePost('${p.id}')">delete</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    c.innerHTML = '<p class="empty">cannot connect to server.</p>';
  }
}

function renderPreview() {
  const box = document.getElementById('preview');
  if (!box) return;
  if (pendingImage) {
    box.innerHTML = `<div class="preview-wrap"><img src="${pendingImage}" class="preview-img" alt=""><button class="preview-remove" onclick="removePendingImage()">x</button></div>`;
  } else {
    box.innerHTML = '';
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

// select image
function selectImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    notify('only images are allowed');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(ev) {
    pendingImage = ev.target.result;
    renderPreview();
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function removePendingImage() {
  pendingImage = null;
  renderPreview();
}

// post
async function submitPost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content && !pendingImage) return;
  try {
    await fetch(API + '/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, image: pendingImage })
    });
    pendingImage = null;
    renderPreview();
    document.getElementById('post-content').value = '';
    renderPosts();
    notify('posted');
  } catch (e) {
    notify('failed to post');
  }
}

// delete
async function deletePost(i) {
  try {
    await fetch(API + '/api/posts/' + i, { method: 'DELETE' });
    renderPosts();
  } catch (e) {
    notify('failed to delete');
  }
}

function notify(msg) {
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// init
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  document.getElementById('current-year').textContent = new Date().getFullYear();
  renderPosts();
});