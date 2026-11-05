const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');

const root = __dirname;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

(async () => {
  console.log('\n=== SINGLE MOVIE WEBSITE – INITIAL SETUP ===\n');

  if (fs.existsSync(path.join(root, '.env'))) {
    const overwrite = (await ask('File .env đã tồn tại. Ghi đè? (y/N): ')).trim().toLowerCase();
    if (overwrite !== 'y') {
      console.log('Đã giữ nguyên .env hiện tại.');
      rl.close();
      return;
    }
  }

  const username = (await ask('Tên đăng nhập quản trị [admin]: ')).trim() || 'admin';
  let password = '';
  while (password.length < 6) {
    password = await ask('Mật khẩu quản trị (ít nhất 6 ký tự): ');
    if (password.length < 6) console.log('Mật khẩu quá ngắn. Hãy nhập ít nhất 6 ký tự.');
  }

  const env = [
    `ADMIN_USERNAME=${username}`,
    `ADMIN_PASSWORD_HASH=${hashPassword(password)}`,
    `SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    'PORT=3000',
    'HOST=127.0.0.1',
    'TRUST_PROXY=1',
    'COOKIE_SECURE=false',
    'PUBLIC_ORIGIN=',
    'MAX_VIDEO_GB=100',
    'MAX_IMAGE_MB=20',
    ''
  ].join('\n');

  fs.writeFileSync(path.join(root, '.env'), env, { mode: 0o600 });
  for (const dir of ['data/sessions', 'storage/videos', 'storage/images', 'storage/.uploads']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }

  const moviePath = path.join(root, 'data', 'movie.json');
  if (!fs.existsSync(moviePath)) {
    fs.writeFileSync(moviePath, JSON.stringify({
      title: 'Tên phim của bạn',
      originalTitle: '',
      releaseYear: new Date().getFullYear(),
      genre: '',
      director: '',
      actors: '',
      description: 'Nhập phần giới thiệu phim trong trang quản trị.',
      posterFile: '',
      backdropFile: '',
      videoFile: '',
      videoName: '',
      videoMime: '',
      videoSize: 0,
      published: true,
      updatedAt: new Date().toISOString()
    }, null, 2));
  }

  console.log('\nThiết lập hoàn tất.');
  console.log('Tiếp theo chạy: npm install  rồi  npm start');
  console.log('Giữ bí mật file .env và không gửi file này cho người khác.\n');
  rl.close();
})().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});
