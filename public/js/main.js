const $ = (id) => document.getElementById(id);
const setText = (id, value, fallback = 'Đang cập nhật') => { const el = $(id); if (el) el.textContent = value || fallback; };

async function loadMovie() {
  let movie = {
    title: 'Hành Trang Quý Giá',
    originalTitle: 'Đạo diễn và biên kịch: Nguyễn Văn Tạ Vũ',
    releaseYear: 2026,
    genre: 'Tâm lý, Gia đình, Đời sống',
    description: 'Hành trang quý giá nhất không nằm trong chiếc vali... mà nằm trong sự hy sinh thầm lặng của gia đình.',
    director: 'Nguyễn Văn Tạ Vũ',
    actors: 'Tạ Vũ, Gemini Characters',
    posterUrl: '/poster.jpg',
    backdropUrl: '/poster.jpg',
    hasVideo: true,
    videoUrl: '/video.mp4',
    videoName: 'Phim của vũ.mp4'
  };

  try {
    const response = await fetch('/movie.json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      movie = { ...movie, ...data };
    }
  } catch (_) {
    // Sử dụng thông tin mặc định nếu không fetch được
  }

  document.title = `${movie.title || 'Xem phim'} – Movie`;
  setText('movie-title', movie.title, 'Phim của Vũ');
  setText('original-title', movie.originalTitle, '');
  setText('year', movie.releaseYear, '2026');
  setText('genre', movie.genre, 'FULL HD');
  setText('description', movie.description, 'Video phát trực tuyến.');
  setText('full-description', movie.description, 'Video phát trực tuyến.');
  setText('director', movie.director, 'Vũ');
  setText('actors', movie.actors, 'Vũ');
  setText('genre-detail', movie.genre, 'Phim ngắn');
  setText('year-detail', movie.releaseYear, '2026');

  if (movie.posterUrl) {
    $('poster').src = movie.posterUrl;
    $('poster').hidden = false;
    $('poster-placeholder').hidden = true;
  }
  if (movie.backdropUrl) {
    $('backdrop').src = movie.backdropUrl;
    $('backdrop').hidden = false;
  }

  $('video-status').textContent = 'Video đã sẵn sàng để phát.';
}

$('footer-year').textContent = new Date().getFullYear();
loadMovie();
