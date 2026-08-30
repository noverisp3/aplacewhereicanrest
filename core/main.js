const API = '';
let nextCursor = null;
let loading = false;

// auth - token based
function getToken(){return localStorage.getItem('auth_token')||''}
function setToken(t){localStorage.setItem('auth_token',t)}
function clearToken(){localStorage.removeItem('auth_token')}

async function doAuth(){
  var input=document.getElementById('auth-input');
  var err=document.getElementById('auth-error');
  var pw=input.value.trim();
  if(!pw){err.textContent='please enter a password';return}
  try{
    var res=await fetch(API+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    var data=await res.json();
    if(data.ok){
      setToken(data.token);
      document.getElementById('auth-screen').classList.add('hidden');
      document.body.style.overflow='';
      loadPosts(false);
    }else{
      err.textContent=data.error+(data.remaining!=null?' ('+data.remaining+' left)':'');
      input.value='';
      input.focus();
    }
  }catch(e){err.textContent='connection error'}
}

function checkAuth(){
  var token=getToken();
  if(!token){
    document.getElementById('auth-screen').classList.remove('hidden');
    document.body.style.overflow='hidden';
    return false;
  }
  document.getElementById('auth-screen').classList.add('hidden');
  return true;
}

// theme
const THEMES = ['light','dark','sepia','moon','forest','rose','minimal','typewriter','typewriter-dark'];
function applyTheme(){var t=localStorage.getItem('theme')||'light';document.body.className=t;var b=document.getElementById('theme-toggle');if(b)b.textContent=t.charAt(0);document.querySelectorAll('.theme-option').forEach(function(o){o.classList.toggle('active',o.dataset.theme===t)})}
function setTheme(t){localStorage.setItem('theme',t);applyTheme();closeMenu()}
function toggleMenu(){document.getElementById('theme-menu').classList.toggle('open')}
function closeMenu(){document.getElementById('theme-menu').classList.remove('open')}
document.addEventListener('click',function(e){if(!e.target.closest('.theme-picker'))closeMenu()});

// pending image
let pendingImage = null;

// search
let searchTimer = null;
function getSearchParams(){
  var q=document.getElementById('search-input').value.trim();
  var f=document.getElementById('date-from').value;
  var t=document.getElementById('date-to').value;
  var s=[];
  if(q)s.push('q='+encodeURIComponent(q));
  if(f)s.push('from='+f);
  if(t)s.push('to='+t);
  return s.length?'&'+s.join('&'):'';
}
function debounceSearch(){clearTimeout(searchTimer);searchTimer=setTimeout(searchPosts,300)}
function searchPosts(){nextCursor=null;loadPosts(false);updateClearBtn()}
function clearSearch(){document.getElementById('search-input').value='';document.getElementById('date-from').value='';document.getElementById('date-to').value='';searchPosts()}
function updateClearBtn(){var q=document.getElementById('search-input').value.trim();var f=document.getElementById('date-from').value;var t=document.getElementById('date-to').value;var b=document.getElementById('clear-search');if(b)b.style.display=(q||f||t)?'':'none'}

function authHeaders(){
  var h={'Content-Type':'application/json'};
  var t=getToken();
  if(t)h['Authorization']='Bearer '+t;
  return h;
}

function handleAuthFail(){clearToken();checkAuth()}

// render posts
async function loadPosts(append) {
  if (loading) return;
  var token = getToken();
  if (!token) return;
  loading = true;
  updateSentinel();
  try {
    var params = getSearchParams();
    let url = API + '/api/posts?limit=5' + params;
    if (nextCursor) url += '&cursor=' + nextCursor;
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { handleAuthFail(); loading = false; return; }
    const data = await res.json();
    const c = document.getElementById('posts-container');
    var counter = document.getElementById('post-count');
    if (!append) c.innerHTML = '';
    if (!data.posts.length && !append) {
      var hasFilter = params.length > 0;
      c.innerHTML = '<p class="empty">' + (hasFilter ? 'no matching posts.' : 'nothing here yet.') + '</p>';
      if (counter) counter.textContent = '';
      loading = false;
      updateSentinel();
      return;
    }
    if (!append && counter) {
      var total = data.total;
      counter.textContent = total + (total === 1 ? ' post' : ' posts');
    }
    const html = data.posts.map(p => {
      const img = p.image ? '<img src="' + p.image + '" class="post-image" alt="" onclick="openLightbox(\'' + p.image.replace(/'/g, "\\'") + '\')" style="cursor:zoom-in">' : '';
      const txt = p.content ? '<div class="post-body">' + esc(p.content) + '</div>' : '';
      return '<div class="post post-hidden">' + txt + img + '<div class="post-footer"><span class="post-date">' + p.date + '</span><button class="post-delete" data-id="' + p.id + '">delete</button></div></div>';
    }).join('');
    if (append) {
      c.insertAdjacentHTML('beforeend', html);
    } else {
      c.innerHTML = html;
    }
    nextCursor = data.nextCursor;
    observePosts();
    c.querySelectorAll('.post-delete').forEach(function(b) {
      b.onclick = function() { deletePost(this.dataset.id) };
    });
  } catch (e) {
    if (!append) {
      document.getElementById('posts-container').innerHTML = '<p class="empty">cannot connect to server.</p>';
    }
  }
  loading = false;
  updateSentinel();
}

function updateSentinel() {
  var s = document.getElementById('scroll-sentinel');
  if (!s) return;
  var hasPosts = document.querySelectorAll('.post').length > 0;
  s.style.display = (hasPosts && (nextCursor || loading)) ? '' : 'none';
}

// intersection observer for animations
let observer;
function observePosts() {
  if (!observer) {
    observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('post-visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
  }
  document.querySelectorAll('.post-hidden').forEach(function(el) {
    observer.observe(el);
  });
}

// infinite scroll sentinel
function setupInfiniteScroll() {
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;
  const io = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting && nextCursor && !loading) {
      loadPosts(true);
    }
  }, { rootMargin: '200px' });
  io.observe(sentinel);
}

function renderPreview(){var b=document.getElementById('preview');if(!b)return;if(pendingImage){b.innerHTML='<div class="preview-wrap"><img src="'+pendingImage+'" class="preview-img" alt=""><button class="preview-remove" onclick="removePendingImage()">x</button></div>'}else{b.innerHTML=''}}
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML.replace(/\n/g,'<br>')}

function compressImage(file, cb) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var w = img.width, h = img.height;
      var max = 1200;
      if (w > max) { h = h * max / w; w = max; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(function(blob) {
        var r2 = new FileReader();
        r2.onload = function() { cb(r2.result) };
        r2.readAsDataURL(blob);
      }, 'image/webp', 0.8);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function selectImage(e) {
  var f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) { notify('only images are allowed'); e.target.value = ''; return; }
  notify('compressing...');
  compressImage(f, function(data) { pendingImage = data; renderPreview(); notify('image ready') });
  e.target.value = '';
}
function removePendingImage(){pendingImage=null;renderPreview()}

async function submitPost(){
  var c=document.getElementById('post-content').value.trim();
  if(!c&&!pendingImage)return;
  var token=getToken();
  if(!token)return;
  try{
    var res=await fetch(API+'/api/posts',{method:'POST',headers:authHeaders(),body:JSON.stringify({content:c,image:pendingImage})});
    if(res.status===401){handleAuthFail();return}
    pendingImage=null;renderPreview();
    var ta=document.getElementById('post-content');ta.value='';ta.style.height='auto';ta._minH=0;
    localStorage.removeItem('draft_text');
    nextCursor=null;await loadPosts(false);notify('posted')
  }catch(e){notify('failed to post')}
}

var deleteConfirmId = null;
var deleteTimer = null;
function deletePost(i){
  clearTimeout(deleteTimer);
  if(deleteConfirmId === i){
    doDelete(i);
    deleteConfirmId = null;
    return;
  }
  deleteConfirmId = i;
  document.querySelectorAll('.post-delete').forEach(function(b){
    if(b.dataset.id === i){
      b.textContent = 'delete?';
      b.classList.add('confirm');
    } else {
      b.textContent = 'delete';
      b.classList.remove('confirm');
    }
  });
  deleteTimer = setTimeout(function(){
    deleteConfirmId = null;
    document.querySelectorAll('.post-delete').forEach(function(b){
      b.textContent = 'delete';
      b.classList.remove('confirm');
    });
  }, 5000);
}
async function doDelete(i){
  var token=getToken();
  if(!token)return;
  try{
    var h=authHeaders();
    h['x-delete-secret']='rest-mi-2026';
    var res=await fetch(API+'/api/posts/'+i,{method:'DELETE',headers:h});
    if(res.status===401){handleAuthFail();return}
    nextCursor=null;await loadPosts(false)
  }catch(e){notify('failed to delete')}
}

function notify(m){var e=document.createElement('div');e.className='notification';e.textContent=m;document.body.appendChild(e);setTimeout(function(){e.remove()},2500)}

// lightbox + zoom
var lightboxSrc = '';
var lbScale = 1, lbX = 0, lbY = 0;
var pinchDist = 0, pinchStartScale = 1;
var lbDragging = false, lbLastX = 0, lbLastY = 0;
var lbTapTimer = null;

function lbTransform() {
  var img = document.getElementById('lightbox-img');
  img.style.transform = 'scale(' + lbScale + ') translate(' + lbX + 'px,' + lbY + 'px)';
}

function lbResetZoom() {
  lbScale = 1; lbX = 0; lbY = 0;
  var img = document.getElementById('lightbox-img');
  img.style.transition = 'transform 0.25s ease';
  lbTransform();
  setTimeout(function() { img.style.transition = ''; }, 250);
}

function openLightbox(src) {
  lightboxSrc = src;
  lbScale = 1; lbX = 0; lbY = 0;
  var img = document.getElementById('lightbox-img');
  img.src = src;
  img.style.transform = '';
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (e.target === document.getElementById('lightbox') || e.target.closest('.lightbox-btn')) {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    lightboxSrc = '';
    lbResetZoom();
  }
}

function downloadLightbox(e) {
  e.stopPropagation();
  if (!lightboxSrc) return;
  var a = document.createElement('a');
  a.href = lightboxSrc;
  a.download = 'image-' + Date.now() + '.webp';
  a.click();
}

// PC: wheel zoom
document.addEventListener('wheel', function(e) {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.target !== document.getElementById('lightbox-img') && !e.target.closest('.lightbox-img')) return;
  e.preventDefault();
  var delta = e.deltaY > 0 ? -0.15 : 0.15;
  var newScale = Math.max(0.5, Math.min(5, lbScale + delta));
  if (newScale === lbScale) return;
  lbScale = newScale;
  document.getElementById('lightbox-img').style.transition = '';
  lbTransform();
}, { passive: false });

// PC: drag to pan when zoomed
document.addEventListener('mousedown', function(e) {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.target !== document.getElementById('lightbox-img')) return;
  lbDragging = true;
  lbLastX = e.clientX;
  lbLastY = e.clientY;
  e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
  if (!lbDragging) return;
  var dx = (e.clientX - lbLastX) / lbScale;
  var dy = (e.clientY - lbLastY) / lbScale;
  lbX += dx;
  lbY += dy;
  lbLastX = e.clientX;
  lbLastY = e.clientY;
  lbTransform();
});

document.addEventListener('mouseup', function() { lbDragging = false; });

// Mobile: pinch to zoom + drag pan
var lightboxEl;
document.addEventListener('DOMContentLoaded', function() {
  lightboxEl = document.getElementById('lightbox-img');
});

function getTouchDist(t) {
  var dx = t[0].clientX - t[1].clientX;
  var dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

document.addEventListener('touchstart', function(e) {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  var img = document.getElementById('lightbox-img');

  // Pinch start (2 fingers)
  if (e.touches.length === 2) {
    e.preventDefault();
    pinchDist = getTouchDist(e.touches);
    pinchStartScale = lbScale;
    img.style.transition = '';
    return;
  }

  // Single finger
  if (e.touches.length === 1 && e.target === img) {
    var now = Date.now();
    if (lbTapTimer && now - lbTapTimer < 300) {
      e.preventDefault();
      lbScale = lbScale > 1 ? 1 : 2;
      img.style.transition = 'transform 0.25s ease';
      lbTransform();
      setTimeout(function() { img.style.transition = ''; }, 250);
      lbTapTimer = null;
    } else {
      lbTapTimer = now;
      // Pan
      if (lbScale > 1) {
        e.preventDefault();
        lbDragging = true;
        lbLastX = e.touches[0].clientX;
        lbLastY = e.touches[0].clientY;
      }
    }
  }
}, { passive: false });

document.addEventListener('touchmove', function(e) {
  if (!document.getElementById('lightbox').classList.contains('open')) return;

  // Pinch zoom
  if (e.touches.length === 2 && pinchDist > 0) {
    e.preventDefault();
    var dist = getTouchDist(e.touches);
    var newScale = Math.max(0.5, Math.min(5, pinchStartScale * (dist / pinchDist)));
    lbScale = newScale;
    lbTransform();
    return;
  }

  // Pan
  if (lbDragging && e.touches.length === 1) {
    e.preventDefault();
    var dx = (e.touches[0].clientX - lbLastX) / lbScale;
    var dy = (e.touches[0].clientY - lbLastY) / lbScale;
    lbX += dx;
    lbY += dy;
    lbLastX = e.touches[0].clientX;
    lbLastY = e.touches[0].clientY;
    lbTransform();
  }
}, { passive: false });

document.addEventListener('touchend', function(e) {
  if (e.touches.length < 2) pinchDist = 0;
  lbDragging = false;
  // Snap back if zoomed out to 1
  if (lbScale <= 1) { lbX = 0; lbY = 0; lbScale = 1; lbTransform(); }
});

// Double-click reset (PC)
document.addEventListener('dblclick', function(e) {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.target !== document.getElementById('lightbox-img')) return;
  e.preventDefault();
  if (lbScale > 1) { lbResetZoom(); }
  else {
    lbScale = 2.5;
    var img = document.getElementById('lightbox-img');
    img.style.transition = 'transform 0.25s ease';
    lbTransform();
    setTimeout(function() { img.style.transition = ''; }, 250);
  }
});

// Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('lightbox').classList.contains('open')) {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    lightboxSrc = '';
    lbResetZoom();
  }
});

document.addEventListener('DOMContentLoaded',function(){
  applyTheme();
  document.getElementById('current-year').textContent=new Date().getFullYear();
  checkAuth();
  if(getToken()) loadPosts(false);
  setupInfiniteScroll();

  var ta = document.getElementById('post-content');
  if (ta) {
    // Load draft
    var draft = localStorage.getItem('draft_text');
    if (draft) { ta.value = draft; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

    ta.addEventListener('input', function() {
      if (!this._minH) this._minH = this.offsetHeight;
      this.style.height = 'auto';
      var newH = Math.max(this._minH, this.scrollHeight);
      this.style.height = newH + 'px';
      // Auto-save draft
      var len = this.value.length;
      if (len > 0) { localStorage.setItem('draft_text', this.value); }
      else { localStorage.removeItem('draft_text'); }
    });
    ta.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitPost(); }
    });
    ta.addEventListener('dragover', function(e) { e.preventDefault(); ta.style.borderColor = 'var(--text-dim)'; });
    ta.addEventListener('dragleave', function() { ta.style.borderColor = ''; });
    ta.addEventListener('drop', function(e) {
      e.preventDefault();
      ta.style.borderColor = '';
      var f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) {
        notify('compressing...');
        compressImage(f, function(data) { pendingImage = data; renderPreview(); notify('image ready') });
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      var si = document.getElementById('search-input');
      if (si) si.focus();
    }
  });

  loadActivity();
})

// activity calendar
function loadActivity() {
  var cal = document.getElementById('activity-calendar');
  if (!cal) return;
  var token = getToken();
  if (!token) return;
  fetch(API + '/api/activity', { headers: authHeaders() })
    .then(function(r) { return r.json() })
    .then(function(data) {
      var map = {};
      (data.activity || []).forEach(function(a) { map[a.day] = a.count });
      var today = new Date();
      var html = '';
      for (var i = 89; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var c = map[key] || 0;
        var lvl = c === 0 ? '' : c === 1 ? 'l1' : c === 2 ? 'l2' : 'l3';
        var title = key + (c ? ' (' + c + ' post' + (c > 1 ? 's' : '') + ')' : '');
        html += '<div class="cal-dot ' + lvl + '" title="' + title + '"></div>';
      }
      cal.innerHTML = html;
    })
    .catch(function() {});
}