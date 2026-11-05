const $ = (id) => document.getElementById(id);
let csrfToken = '';
let activeXhr = null;
let activeUploadId = null;
let cancelRequested = false;

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (csrfToken && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Lỗi HTTP ${response.status}`);
  return data;
}

function message(id, text, isError = false) {
  const el = $(id);
  el.textContent = text;
  el.style.color = isError ? '#ff8585' : '#ffc27d';
}

async function getCsrf() {
  const data = await api('/api/admin/csrf');
  csrfToken = data.csrfToken;
}

async function checkSession() {
  const data = await api('/api/admin/me');
  if (data.authenticated) {
    await getCsrf();
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    await loadDashboard();
  } else {
    $('login-panel').hidden = false;
    $('dashboard').hidden = true;
  }
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  message('login-message', 'Đang xác thực...');
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('login-username').value, password: $('login-password').value })
    });
    $('login-password').value = '';
    await getCsrf();
    $('login-panel').hidden = true;
    $('dashboard').hidden = false;
    await loadDashboard();
  } catch (error) { message('login-message', error.message, true); }
});

$('logout-button').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST' });
    csrfToken = '';
    $('dashboard').hidden = true;
    $('login-panel').hidden = false;
    message('login-message', 'Bạn đã đăng xuất.');
  } catch (error) { alert(error.message); }
});

async function loadDashboard() {
  // Endpoint quản trị vẫn trả dữ liệu khi phim đang ở trạng thái chưa xuất bản.
  const adminMovie = await api('/api/admin/movie-data');
  for (const key of ['title','originalTitle','releaseYear','genre','director','actors','description']) {
    $(key).value = adminMovie[key] ?? '';
  }
  $('published').checked = adminMovie.published !== false;

  setImagePreview('poster', adminMovie.posterUrl);
  setImagePreview('backdrop', adminMovie.backdropUrl);
  $('current-video-name').textContent = adminMovie.videoName || 'Chưa có video';
  $('current-video-size').textContent = adminMovie.videoSize ? formatBytes(adminMovie.videoSize) : 'Chưa có file được tải lên';
  $('delete-video-button').disabled = !adminMovie.hasVideo;
}

function setImagePreview(kind, url) {
  const img = $(`${kind}-preview`);
  const empty = $(`${kind}-empty`);
  if (url) {
    img.src = `${url}?v=${Date.now()}`;
    img.hidden = false;
    empty.hidden = true;
  } else {
    img.hidden = true;
    empty.hidden = false;
  }
}

$('movie-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/movie', {
      method: 'PUT',
      body: JSON.stringify({
        title: $('title').value,
        originalTitle: $('originalTitle').value,
        releaseYear: $('releaseYear').value,
        genre: $('genre').value,
        director: $('director').value,
        actors: $('actors').value,
        description: $('description').value,
        published: $('published').checked
      })
    });
    message('movie-message', 'Đã lưu thông tin phim.');
  } catch (error) { message('movie-message', error.message, true); }
});

document.querySelectorAll('[data-image-kind]').forEach(button => {
  button.addEventListener('click', async () => {
    const kind = button.dataset.imageKind;
    const input = $(`${kind}-file`);
    if (!input.files.length) return message('image-message', 'Hãy chọn ảnh trước.', true);
    const form = new FormData();
    form.append('image', input.files[0]);
    try {
      const result = await api(`/api/admin/image/${kind}`, { method: 'POST', body: form });
      setImagePreview(kind, result.url);
      input.value = '';
      message('image-message', `Đã cập nhật ${kind === 'poster' ? 'poster' : 'backdrop'}.`);
    } catch (error) { message('image-message', error.message, true); }
  });
});

function xhrRequest(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total); };
    xhr.onload = () => {
      activeXhr = null;
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload lỗi HTTP ${xhr.status}`));
    };
    xhr.onerror = () => { activeXhr = null; reject(new Error('Mất kết nối khi upload.')); };
    xhr.onabort = () => { activeXhr = null; reject(new Error('Upload đã bị hủy.')); };
    xhr.send(formData);
  });
}

$('upload-video-button').addEventListener('click', async () => {
  const file = $('video-file').files[0];
  if (!file) return message('video-message', 'Hãy chọn video từ thiết bị.', true);
  if (!/\.(mp4|webm)$/i.test(file.name)) return message('video-message', 'Chỉ hỗ trợ MP4 hoặc WebM.', true);

  cancelRequested = false;
  $('upload-progress-wrap').hidden = false;
  $('upload-video-button').disabled = true;
  $('video-file').disabled = true;
  $('upload-status').textContent = 'Đang khởi tạo upload...';
  $('upload-percent').textContent = '0%';
  $('upload-progress').style.width = '0%';

  try {
    const init = await api('/api/admin/upload/init', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, size: file.size })
    });
    activeUploadId = init.uploadId;
    let uploaded = 0;

    for (let index = 0; index < init.totalChunks; index++) {
      if (cancelRequested) throw new Error('Upload đã bị hủy.');
      const start = index * init.chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + init.chunkSize));
      const form = new FormData();
      form.append('chunk', chunk, 'chunk.bin');
      $('upload-status').textContent = `Đang tải phần ${index + 1}/${init.totalChunks}...`;

      await xhrRequest(`/api/admin/upload/${init.uploadId}/${index}`, form, (loaded) => {
        const percent = Math.min(99, Math.floor(((uploaded + loaded) / file.size) * 100));
        $('upload-percent').textContent = `${percent}%`;
        $('upload-progress').style.width = `${percent}%`;
      });
      uploaded += chunk.size;
      const percent = Math.floor((uploaded / file.size) * 100);
      $('upload-percent').textContent = `${percent}%`;
      $('upload-progress').style.width = `${percent}%`;
    }

    $('upload-status').textContent = 'Đang hoàn tất và cập nhật website...';
    await api(`/api/admin/upload/${init.uploadId}/complete`, { method: 'POST' });
    activeUploadId = null;
    $('upload-percent').textContent = '100%';
    $('upload-progress').style.width = '100%';
    $('upload-status').textContent = 'Upload thành công!';
    $('video-file').value = '';
    message('video-message', 'Video đã được lưu vào ổ cứng và sẵn sàng phát.');
    await loadDashboard();
  } catch (error) {
    if (activeUploadId) {
      await api(`/api/admin/upload/${activeUploadId}`, { method: 'DELETE' }).catch(() => {});
      activeUploadId = null;
    }
    message('video-message', error.message, true);
    $('upload-status').textContent = 'Upload chưa hoàn tất.';
  } finally {
    $('upload-video-button').disabled = false;
    $('video-file').disabled = false;
    activeXhr = null;
  }
});

$('cancel-upload').addEventListener('click', () => {
  cancelRequested = true;
  if (activeXhr) activeXhr.abort();
});

$('delete-video-button').addEventListener('click', async () => {
  if (!confirm('Bạn chắc chắn muốn xóa video hiện tại?')) return;
  try {
    await api('/api/admin/video', { method: 'DELETE' });
    message('video-message', 'Đã xóa video.');
    await loadDashboard();
  } catch (error) { message('video-message', error.message, true); }
});

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

checkSession().catch(error => message('login-message', error.message, true));
