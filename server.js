require('dotenv').config();

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const app = express();
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STORAGE_DIR = path.join(ROOT, 'storage');
const VIDEO_DIR = path.join(STORAGE_DIR, 'videos');
const IMAGE_DIR = path.join(STORAGE_DIR, 'images');
const UPLOAD_DIR = path.join(STORAGE_DIR, '.uploads');
const SESSION_DIR = path.join(DATA_DIR, 'sessions');
const MOVIE_FILE = path.join(DATA_DIR, 'movie.json');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = Math.max(1, Number(process.env.MAX_VIDEO_GB || 100)) * 1024 ** 3;
const MAX_IMAGE_BYTES = Math.max(1, Number(process.env.MAX_IMAGE_MB || 20)) * 1024 ** 2;

for (const dir of [PUBLIC_DIR, DATA_DIR, VIDEO_DIR, IMAGE_DIR, UPLOAD_DIR, SESSION_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
  console.error('Thiếu cấu hình bảo mật. Hãy chạy npm run setup trước.');
  process.exit(1);
}

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      styleSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

app.use(session({
  name: 'movie_admin_sid',
  store: new FileStore({
    path: SESSION_DIR,
    ttl: 8 * 60 * 60,
    retries: 0,
    logFn: () => {}
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ error: 'Bạn cần đăng nhập quản trị.' });
}

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  const expected = process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`;
  if (!origin || origin !== expected) {
    return res.status(403).json({ error: 'Yêu cầu bị từ chối do kiểm tra nguồn truy cập.' });
  }
  next();
}

function requireCsrf(req, res, next) {
  const supplied = req.get('x-csrf-token') || '';
  const expected = req.session?.csrfToken || '';
  if (!supplied || !expected || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ error: 'CSRF token không hợp lệ. Hãy tải lại trang quản trị.' });
  }
  next();
}

function safeText(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function readMovie() {
  try {
    return JSON.parse(await fsp.readFile(MOVIE_FILE, 'utf8'));
  } catch {
    const initial = {
      title: 'Tên phim của bạn', originalTitle: '', releaseYear: new Date().getFullYear(),
      genre: '', director: '', actors: '', description: '',
      posterFile: '', backdropFile: '', videoFile: '', videoName: '',
      videoMime: '', videoSize: 0, published: true, updatedAt: new Date().toISOString()
    };
    await writeMovie(initial);
    return initial;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fsp.rename(tempPath, filePath);
}

async function writeMovie(movie) {
  movie.updatedAt = new Date().toISOString();
  await writeJsonAtomic(MOVIE_FILE, movie);
}

function publicMovie(movie) {
  return {
    title: movie.title || '',
    originalTitle: movie.originalTitle || '',
    releaseYear: movie.releaseYear || '',
    genre: movie.genre || '',
    director: movie.director || '',
    actors: movie.actors || '',
    description: movie.description || '',
    posterUrl: movie.posterFile ? `/media/images/${encodeURIComponent(movie.posterFile)}` : '',
    backdropUrl: movie.backdropFile ? `/media/images/${encodeURIComponent(movie.backdropFile)}` : '',
    hasVideo: Boolean(movie.videoFile && fs.existsSync(path.join(VIDEO_DIR, path.basename(movie.videoFile)))),
    videoName: movie.videoName || '',
    videoSize: movie.videoSize || 0,
    published: movie.published !== false,
    updatedAt: movie.updatedAt || ''
  };
}

function parsePasswordHash(encoded) {
  const parts = String(encoded || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return null;
  try {
    return { salt: Buffer.from(parts[1], 'hex'), hash: Buffer.from(parts[2], 'hex') };
  } catch {
    return null;
  }
}

async function verifyPassword(password) {
  const parsed = parsePasswordHash(process.env.ADMIN_PASSWORD_HASH);
  if (!parsed || parsed.hash.length !== 64) return false;
  const derived = await scrypt(password, parsed.salt, parsed.hash.length);
  return crypto.timingSafeEqual(parsed.hash, derived);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extensionForVideo(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ['.mp4', '.webm'].includes(ext) ? ext : '';
}

const chunkMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHUNK_SIZE, files: 1 }
});

const imageMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/watch', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'watch.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

app.use('/media/images', express.static(IMAGE_DIR, {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
  maxAge: '1h'
}));

app.use(express.static(PUBLIC_DIR, { index: false, dotfiles: 'deny' }));

app.get('/api/movie', async (_req, res, next) => {
  try {
    const movie = await readMovie();
    if (movie.published === false) return res.status(404).json({ error: 'Phim hiện chưa được xuất bản.' });
    res.set('Cache-Control', 'no-store');
    res.json(publicMovie(movie));
  } catch (err) { next(err); }
});

async function streamVideo(req, res, next) {
  try {
    const movie = await readMovie();
    if (movie.published === false || !movie.videoFile) return res.status(404).send('Video chưa được xuất bản.');
    const filename = path.basename(movie.videoFile);
    const filePath = path.join(VIDEO_DIR, filename);
    const stat = await fsp.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) return res.status(404).send('Không tìm thấy video.');

    const contentType = movie.videoMime === 'video/webm' ? 'video/webm' : 'video/mp4';
    res.set({
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });

    const range = req.headers.range;
    if (!range) {
      res.status(200).set('Content-Length', stat.size);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(filePath).pipe(res);
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return res.status(416).set('Content-Range', `bytes */${stat.size}`).end();

    let start = match[1] ? Number(match[1]) : null;
    let end = match[2] ? Number(match[2]) : null;

    if (start === null) {
      const suffixLength = end;
      if (!suffixLength || suffixLength <= 0) return res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
      start = Math.max(0, stat.size - suffixLength);
      end = stat.size - 1;
    } else {
      end = end === null ? stat.size - 1 : Math.min(end, stat.size - 1);
    }

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= stat.size || end < start) {
      return res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
    }

    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1
    });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) { next(err); }
}
app.get('/api/video', streamVideo);
app.head('/api/video', streamVideo);

app.get('/api/admin/me', (req, res) => {
  res.json({ authenticated: req.session?.isAdmin === true });
});

app.post('/api/admin/login', sameOrigin, loginLimiter, async (req, res, next) => {
  try {
    const username = safeText(req.body?.username, 100);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (username !== process.env.ADMIN_USERNAME || password.length < 1 || password.length > 200) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    if (!(await verifyPassword(password))) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.isAdmin = true;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      req.session.save(saveErr => {
        if (saveErr) return next(saveErr);
        res.json({ ok: true });
      });
    });
  } catch (err) { next(err); }
});

app.get('/api/admin/csrf', requireAdmin, (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: req.session.csrfToken });
});

app.post('/api/admin/logout', requireAdmin, sameOrigin, requireCsrf, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('movie_admin_sid');
    res.json({ ok: true });
  });
});

app.put('/api/admin/movie', requireAdmin, sameOrigin, requireCsrf, async (req, res, next) => {
  try {
    const movie = await readMovie();
    const body = req.body || {};
    movie.title = safeText(body.title, 180);
    movie.originalTitle = safeText(body.originalTitle, 180);
    movie.releaseYear = body.releaseYear !== '' && body.releaseYear !== null &&
      Number.isInteger(Number(body.releaseYear)) ? Number(body.releaseYear) : '';
    movie.genre = safeText(body.genre, 180);
    movie.director = safeText(body.director, 180);
    movie.actors = safeText(body.actors, 500);
    movie.description = safeText(body.description, 5000);
    movie.published = body.published !== false;
    await writeMovie(movie);
    res.json({ ok: true, movie: publicMovie(movie) });
  } catch (err) { next(err); }
});

app.post('/api/admin/upload/init', requireAdmin, sameOrigin, requireCsrf, uploadLimiter, async (req, res, next) => {
  try {
    const filename = safeText(req.body?.filename, 240);
    const size = Number(req.body?.size);
    const ext = extensionForVideo(filename);
    if (!ext) return res.status(400).json({ error: 'Chỉ hỗ trợ video MP4 hoặc WebM.' });
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return res.status(400).json({ error: `Dung lượng video phải từ 1 byte đến ${process.env.MAX_VIDEO_GB || 100} GB.` });
    }
    const totalChunks = Math.ceil(size / CHUNK_SIZE);
    const id = crypto.randomUUID();
    const manifest = {
      id, filename: path.basename(filename), ext, size, totalChunks,
      nextChunk: 0, receivedBytes: 0,
      mime: ext === '.webm' ? 'video/webm' : 'video/mp4',
      createdAt: Date.now()
    };
    await fsp.writeFile(path.join(UPLOAD_DIR, `${id}.part`), Buffer.alloc(0), { flag: 'wx' });
    await writeJsonAtomic(path.join(UPLOAD_DIR, `${id}.json`), manifest);
    res.json({ uploadId: id, chunkSize: CHUNK_SIZE, totalChunks });
  } catch (err) { next(err); }
});

app.post('/api/admin/upload/:id/complete', requireAdmin, sameOrigin, requireCsrf, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: 'Upload ID không hợp lệ.' });
    const manifestPath = path.join(UPLOAD_DIR, `${id}.json`);
    let manifest;
    try { manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')); }
    catch { return res.status(404).json({ error: 'Phiên upload không tồn tại.' }); }

    if (manifest.nextChunk !== manifest.totalChunks || manifest.receivedBytes !== manifest.size) {
      return res.status(400).json({ error: 'Video chưa được tải lên đầy đủ.' });
    }

    const newFilename = `movie-${Date.now()}-${id.slice(0, 8)}${manifest.ext}`;
    const tempPath = path.join(UPLOAD_DIR, `${id}.part`);
    const finalPath = path.join(VIDEO_DIR, newFilename);
    await fsp.rename(tempPath, finalPath);

    const movie = await readMovie();
    const oldFilename = movie.videoFile;
    movie.videoFile = newFilename;
    movie.videoName = manifest.filename;
    movie.videoMime = manifest.mime;
    movie.videoSize = manifest.size;
    try {
      await writeMovie(movie);
    } catch (err) {
      await fsp.unlink(finalPath).catch(() => {});
      throw err;
    }

    await fsp.unlink(manifestPath).catch(() => {});
    if (oldFilename && oldFilename !== newFilename) {
      await fsp.unlink(path.join(VIDEO_DIR, path.basename(oldFilename))).catch(() => {});
    }
    res.json({ ok: true, movie: publicMovie(movie) });
  } catch (err) { next(err); }
});

app.post('/api/admin/upload/:id/:index(\\d+)', requireAdmin, sameOrigin, requireCsrf, uploadLimiter, (req, res, next) => {
  chunkMulter.single('chunk')(req, res, async err => {
    if (err) return next(err);
    try {
      const id = req.params.id;
      const index = Number(req.params.index);
      if (!isUuid(id) || !Number.isInteger(index) || !req.file) {
        return res.status(400).json({ error: 'Chunk upload không hợp lệ.' });
      }
      const manifestPath = path.join(UPLOAD_DIR, `${id}.json`);
      let manifest;
      try { manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')); }
      catch { return res.status(404).json({ error: 'Phiên upload không tồn tại.' }); }

      if (index !== manifest.nextChunk || index >= manifest.totalChunks) {
        return res.status(409).json({ error: 'Chunk sai thứ tự hoặc đã được tải lên.' });
      }
      if (manifest.receivedBytes + req.file.size > manifest.size) {
        return res.status(400).json({ error: 'Dung lượng chunk vượt quá kích thước đã khai báo.' });
      }
      await fsp.appendFile(path.join(UPLOAD_DIR, `${id}.part`), req.file.buffer);
      manifest.receivedBytes += req.file.size;
      manifest.nextChunk += 1;
      await writeJsonAtomic(manifestPath, manifest);
      res.json({ ok: true, nextChunk: manifest.nextChunk, receivedBytes: manifest.receivedBytes });
    } catch (error) { next(error); }
  });
});

app.delete('/api/admin/upload/:id', requireAdmin, sameOrigin, requireCsrf, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: 'Upload ID không hợp lệ.' });
    await fsp.unlink(path.join(UPLOAD_DIR, `${id}.part`)).catch(() => {});
    await fsp.unlink(path.join(UPLOAD_DIR, `${id}.json`)).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.post('/api/admin/image/:kind', requireAdmin, sameOrigin, requireCsrf, (req, res, next) => {
  imageMulter.single('image')(req, res, async err => {
    if (err) return next(err);
    try {
      const kind = req.params.kind;
      if (!['poster', 'backdrop'].includes(kind) || !req.file) {
        return res.status(400).json({ error: 'Ảnh upload không hợp lệ.' });
      }
      const ext = path.extname(req.file.originalname).toLowerCase();
      const allowed = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp'
      };
      if (!allowed[ext] || allowed[ext] !== req.file.mimetype) {
        return res.status(400).json({ error: 'Chỉ hỗ trợ JPG, PNG hoặc WebP hợp lệ.' });
      }
      const filename = `${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      const target = path.join(IMAGE_DIR, filename);
      await fsp.writeFile(target, req.file.buffer, { flag: 'wx' });
      const movie = await readMovie();
      const key = kind === 'poster' ? 'posterFile' : 'backdropFile';
      const old = movie[key];
      movie[key] = filename;
      try { await writeMovie(movie); }
      catch (saveErr) {
        await fsp.unlink(target).catch(() => {});
        throw saveErr;
      }
      if (old) await fsp.unlink(path.join(IMAGE_DIR, path.basename(old))).catch(() => {});
      res.json({ ok: true, url: `/media/images/${encodeURIComponent(filename)}` });
    } catch (error) { next(error); }
  });
});

app.delete('/api/admin/video', requireAdmin, sameOrigin, requireCsrf, async (_req, res, next) => {
  try {
    const movie = await readMovie();
    const old = movie.videoFile;
    movie.videoFile = '';
    movie.videoName = '';
    movie.videoMime = '';
    movie.videoSize = 0;
    await writeMovie(movie);
    if (old) await fsp.unlink(path.join(VIDEO_DIR, path.basename(old))).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});


app.get('/api/admin/movie-data', requireAdmin, async (_req, res, next) => {
  try {
    const movie = await readMovie();
    res.set('Cache-Control', 'no-store');
    res.json({
      ...publicMovie(movie),
      posterFile: movie.posterFile || '',
      backdropFile: movie.backdropFile || ''
    });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File vượt quá dung lượng cho phép.' : 'Upload file không hợp lệ.';
    return res.status(400).json({ error: message });
  }
  res.status(500).json({ error: 'Máy chủ gặp lỗi. Hãy kiểm tra cửa sổ terminal.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Single Movie Website đang chạy tại http://${HOST}:${PORT}`);
  console.log('Nhấn Ctrl+C để dừng server.');
});
