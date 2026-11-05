const $ = (id) => document.getElementById(id);
const video = $('movie-player');
const progressKey = 'singleMovieWatchPosition';

async function initPlayer() {
  $('footer-year').textContent = new Date().getFullYear();
  try {
    const response = await fetch('/api/movie', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không thể tải thông tin phim.');
    const movie = await response.json();
    $('watch-title').textContent = movie.title || 'Tên phim';
    $('watch-description').textContent = movie.description || 'Chưa có mô tả.';
    $('video-filename').textContent = movie.videoName || 'Video trực tuyến';

    if (!movie.hasVideo) {
      video.hidden = true;
      $('player-empty').hidden = false;
      return;
    }

    video.src = '/api/video';
    const saved = Number(localStorage.getItem(progressKey) || 0);

    video.addEventListener('loadedmetadata', () => {
      if (saved > 30 && saved < video.duration - 60) {
        const resume = document.createElement('button');
        resume.className = 'button button-primary';
        resume.type = 'button';
        resume.textContent = `Tiếp tục từ ${formatTime(saved)}`;
        resume.style.margin = '10px 0';
        resume.addEventListener('click', () => {
          video.currentTime = saved;
          video.play().catch(() => {});
          resume.remove();
          $('resume-note').textContent = 'Đã tiếp tục từ vị trí xem trước.';
        });
        $('resume-note').appendChild(resume);
      }
    });

    let lastSaved = 0;
    video.addEventListener('timeupdate', () => {
      if (Math.abs(video.currentTime - lastSaved) >= 5) {
        localStorage.setItem(progressKey, String(Math.floor(video.currentTime)));
        lastSaved = video.currentTime;
      }
    });
    video.addEventListener('ended', () => localStorage.removeItem(progressKey));
    window.addEventListener('beforeunload', () => {
      if (Number.isFinite(video.currentTime)) localStorage.setItem(progressKey, String(Math.floor(video.currentTime)));
    });
  } catch (error) {
    $('player-empty').hidden = false;
    video.hidden = true;
    $('player-empty').querySelector('p').textContent = error.message;
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

initPlayer();
