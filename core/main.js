const API = '';
let nextCursor = null;
let loading = false;

// theme
const THEMES = ['light','dark','sepia','moon'];
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

// render posts
async function loadPosts(append) {
  if (loading) return;
  loading = true;
  updateSentinel();
  try {
    var params = getSearchParams();
    let url = API + '/api/posts?limit=5' + params;
    if (nextCursor) url += '&cursor=' + nextCursor;
    const res = await fetch(url);
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
    if (counter) {
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

async function submitPost(){var c=document.getElementById('post-content').value.trim();if(!c&&!pendingImage)return;try{await fetch(API+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c,image:pendingImage})});pendingImage=null;renderPreview();var ta=document.getElementById('post-content');ta.value='';ta.style.height='auto';nextCursor=null;await loadPosts(false);notify('posted')}catch(e){notify('failed to post')}}

const DELETE_SECRET = 'rest-mi-2026';

async function deletePost(i){try{await fetch(API+'/api/posts/'+i,{method:'DELETE',headers:{'x-delete-secret':DELETE_SECRET}});nextCursor=null;await loadPosts(false)}catch(e){notify('failed to delete')}}

function notify(m){var e=document.createElement('div');e.className='notification';e.textContent=m;document.body.appendChild(e);setTimeout(function(){e.remove()},2500)}

// lightbox
var lightboxSrc = '';
function openLightbox(src) {
  lightboxSrc = src;
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(e) {
  if (e.target === document.getElementById('lightbox') || e.target.closest('.lightbox-btn')) {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    lightboxSrc = '';
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
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.getElementById('lightbox').classList.contains('open')) {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    lightboxSrc = '';
  }
});

document.addEventListener('DOMContentLoaded',function(){
  applyTheme();
  document.getElementById('current-year').textContent=new Date().getFullYear();
  loadPosts(false);
  setupInfiniteScroll();

  var ta = document.getElementById('post-content');
  if (ta) {
    ta.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
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
})