const $ = (id) => document.getElementById(id);
const setText = (id, value, fallback = 'Đang cập nhật') => { const el = $(id); if (el) el.textContent = value || fallback; };

async function loadMovie() {
  try {
    const response = await fetch('/api/movie', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không thể tải thông tin phim.');
    const movie = await response.json();

    document.title = `${movie.title || 'Xem phim'} – Movie`;
    setText('movie-title', movie.title, 'Tên phim');
    setText('original-title', movie.originalTitle, '');
    setText('year', movie.releaseYear, '');
    setText('genre', movie.genre, '');
    setText('description', movie.description, 'Chưa có mô tả phim.');
    setText('full-description', movie.description, 'Chưa có mô tả phim.');
    setText('director', movie.director);
    setText('actors', movie.actors);
    setText('genre-detail', movie.genre);
    setText('year-detail', movie.releaseYear);

    if (movie.posterUrl) {
      $('poster').src = movie.posterUrl;
      $('poster').hidden = false;
      $('poster-placeholder').hidden = true;
    }
    if (movie.backdropUrl) {
      $('backdrop').src = movie.backdropUrl;
      $('backdrop').hidden = false;
    }

    if (!movie.hasVideo) {
      $('video-status').textContent = 'Video chưa được tải lên.';
      $('watch-button').classList.add('is-disabled');
      $('watch-button').addEventListener('click', (event) => {
        event.preventDefault();
        alert('Video hiện chưa được tải lên.');
      });
    } else {
      $('video-status').textContent = 'Video đã sẵn sàng để phát.';
    }
  } catch (error) {
    setText('movie-title', 'Chưa thể tải thông tin phim');
    setText('description', error.message);
  }
}
$('footer-year').textContent = new Date().getFullYear();
loadMovie();
