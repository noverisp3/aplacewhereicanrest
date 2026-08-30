const API = '';
let nextCursor = null;
let loading = false;

// theme
function applyTheme(){const d=localStorage.getItem('theme')==='dark';document.body.classList.toggle('dark',d);const b=document.getElementById('theme-toggle');if(b)b.textContent=d?'o':'x'}
function toggleTheme(){const d=document.body.classList.toggle('dark');localStorage.setItem('theme',d?'dark':'light');const b=document.getElementById('theme-toggle');if(b)b.textContent=d?'o':'x'}

// pending image
let pendingImage = null;

// render posts
async function loadPosts(append) {
  if (loading) return;
  loading = true;
  try {
    let url = API + '/api/posts?limit=10';
    if (nextCursor) url += '&cursor=' + nextCursor;
    const res = await fetch(url);
    const data = await res.json();
    const c = document.getElementById('posts-container');
    if (!append) c.innerHTML = '';
    if (!data.posts.length && !append) {
      c.innerHTML = '<p class="empty">nothing here yet.</p>';
      loading = false;
      return;
    }
    const html = data.posts.map(p => {
      const img = p.image ? '<img src="' + p.image + '" class="post-image" alt="">' : '';
      const txt = p.content ? '<div class="post-body">' + esc(p.content) + '</div>' : '';
      return '<div class="post post-hidden">' + img + txt + '<div class="post-footer"><span class="post-date">' + p.date + '</span><button class="post-delete" data-id="' + p.id + '">delete</button></div></div>';
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
function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}

function selectImage(e){var f=e.target.files[0];if(!f)return;if(!f.type.startsWith('image/')){notify('only images are allowed');e.target.value='';return}var r=new FileReader();r.onload=function(ev){pendingImage=ev.target.result;renderPreview()};r.readAsDataURL(f);e.target.value=''}
function removePendingImage(){pendingImage=null;renderPreview()}

async function submitPost(){var c=document.getElementById('post-content').value.trim();if(!c&&!pendingImage)return;try{await fetch(API+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c,image:pendingImage})});pendingImage=null;renderPreview();document.getElementById('post-content').value='';nextCursor=null;await loadPosts(false);notify('posted')}catch(e){notify('failed to post')}}

async function deletePost(i){try{await fetch(API+'/api/posts/'+i,{method:'DELETE'});nextCursor=null;await loadPosts(false)}catch(e){notify('failed to delete')}}

function notify(m){var e=document.createElement('div');e.className='notification';e.textContent=m;document.body.appendChild(e);setTimeout(function(){e.remove()},2500)}

document.addEventListener('DOMContentLoaded',function(){applyTheme();document.getElementById('current-year').textContent=new Date().getFullYear();loadPosts(false);setupInfiniteScroll()})