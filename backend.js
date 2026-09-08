// TikTok Profile Backend API
// npm install express cors axios
// node backend.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const profileResultCache = new Map();
const PROFILE_CACHE_TTL = 5 * 60 * 1000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, { maxAge: '1h', etag: true }));

const requestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://www.tiktok.com/'
};

function cleanUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim();
}

function compactNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;

  const text = String(value).replace(/,/g, '').trim().toUpperCase();
  const match = text.match(/^([\d.]+)\s*([KMB])?$/);
  if (!match) return Number(text) || 0;

  const amount = Number(match[1]);
  const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  return Math.round(amount * (multipliers[match[2]] || 1));
}

function extractImageUrl(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const url = value.trim();
    if (url.startsWith('//')) return `https:${url}`;
    return /^https?:\/\//i.test(url) ? url : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
    return '';
  }

  if (typeof value === 'object') {
    const candidates = [
      value.urlList,
      value.url_list,
      value.urls,
      value.url,
      value.src,
      value.uri
    ];
    for (const candidate of candidates) {
      const url = extractImageUrl(candidate);
      if (url) return url;
    }
  }

  return '';
}

function normalizeUser(user = {}, stats = {}, fallbackUsername) {
  const uniqueId = user.uniqueId || user.unique_id || user.username || fallbackUsername;
  const nickname = user.nickname || user.nickName || user.displayName || uniqueId;

  return {
    uniqueId,
    nickname,
    avatarLarger: extractImageUrl(
      user.avatarLarger ||
      user.avatar_larger ||
      user.avatarMedium ||
      user.avatar_medium ||
      user.avatarThumb ||
      user.avatar_thumb ||
      user.avatar
    ),
    followerCount: compactNumber(stats.followerCount || stats.follower_count || stats.fans || 0),
    followingCount: compactNumber(stats.followingCount || stats.following_count || 0),
    heartCount: compactNumber(stats.heartCount || stats.heart || stats.diggCount || 0),
    videoCount: compactNumber(stats.videoCount || stats.video_count || 0)
  };
}

function findUserDetail(node, username, depth = 0) {
  if (!node || depth > 12) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findUserDetail(item, username, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  if (node.user && (node.stats || node.statsV2)) {
    const user = node.user;
    const id = String(user.uniqueId || user.unique_id || user.username || '').toLowerCase();
    if (!username || id === username.toLowerCase() || user.secUid) {
      return { user, stats: node.stats || node.statsV2 || {} };
    }
  }

  if (node.UserModule?.users) {
    const users = node.UserModule.users;
    const stats = node.UserModule.stats || {};
    const key =
      Object.keys(users).find((item) => item.toLowerCase() === username.toLowerCase()) ||
      Object.keys(users)[0];

    if (key && users[key]) {
      return { user: users[key], stats: stats[key] || {} };
    }
  }

  for (const value of Object.values(node)) {
    const found = findUserDetail(value, username, depth + 1);
    if (found) return found;
  }

  return null;
}

function parseJsonScript(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<script[^>]+id=["']${escapedId}["'][^>]*>([\\s\\S]*?)<\\/script>`));
  if (!match) return null;
  return JSON.parse(match[1]);
}

function parseMetaContent(html, attribute, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${escapedValue}["'][^>]+content=["']([^"']+)["']`, 'i');
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escapedValue}["']`, 'i');
  const match = html.match(pattern) || html.match(reversePattern);
  return match ? match[1].replace(/&amp;/g, '&').trim() : '';
}

async function fetchProfilePage(username) {
  const response = await axios.get(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    timeout: 12000,
    headers: requestHeaders,
    maxRedirects: 5
  });

  const html = response.data;
  const jsonSources = [
    () => parseJsonScript(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__'),
    () => parseJsonScript(html, 'SIGI_STATE')
  ];

  for (const loadJson of jsonSources) {
    try {
      const data = loadJson();
      const detail = findUserDetail(data, username);
      if (detail) {
        return normalizeUser(detail.user, detail.stats, username);
      }
    } catch (error) {
      console.log('Embedded JSON parse failed:', error.message);
    }
  }

  const avatar =
    parseMetaContent(html, 'property', 'og:image') ||
    parseMetaContent(html, 'name', 'twitter:image');
  const title = parseMetaContent(html, 'property', 'og:title');
  const description =
    parseMetaContent(html, 'property', 'og:description') ||
    parseMetaContent(html, 'name', 'description');
  const followerMatch = description.match(/([\d.,]+\s*[KMB]?)\s*(followers|takipçi)/i);
  const followerCount = followerMatch ? compactNumber(followerMatch[1]) : 0;
  if (avatar || followerCount > 0) {
    return {
      uniqueId: username,
      nickname: title ? title.replace(/\s*\|\s*TikTok.*$/i, '').trim() : username,
      avatarLarger: avatar,
      followerCount,
      followingCount: 0,
      heartCount: 0,
      videoCount: 0
    };
  }

  return null;
}

async function fetchProfileApi(username) {
  const response = await axios.get('https://www.tiktok.com/api/user/detail/', {
    params: { username },
    timeout: 10000,
    headers: {
      ...requestHeaders,
      Accept: 'application/json,text/plain,*/*'
    }
  });

  const detail = response.data?.userDetail;
  if (!detail?.user) return null;

  return normalizeUser(detail.user, detail.stats || detail.statsV2 || {}, username);
}

async function fetchOembed(username) {
  const response = await axios.get('https://www.tiktok.com/oembed', {
    params: { url: `https://www.tiktok.com/@${username}` },
    timeout: 8000,
    headers: requestHeaders
  });

  if (!response.data?.author_name) return null;

  return {
    uniqueId: response.data.author_name || username,
    nickname: response.data.author_name || username,
    avatarLarger: response.data.thumbnail_url || `https://unavatar.io/tiktok/${encodeURIComponent(username)}`,
    followerCount: 0,
    followingCount: 0,
    heartCount: 0,
    videoCount: 0
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/avatar', async (req, res) => {
  try {
    const avatarUrl = String(req.query.url || '');
    const parsedUrl = new URL(avatarUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid avatar URL');
    }

    const response = await axios.get(avatarUrl, {
      responseType: 'stream',
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        ...requestHeaders,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        Referer: 'https://www.tiktok.com/'
      }
    });

    const contentType = response.headers['content-type'] || '';
    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      response.data.destroy();
      return res.status(502).send('Avatar yerine gecersiz yanit alindi');
    }

    // CORS ve cache headers ekle
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    response.data.pipe(res);
  } catch (error) {
    const status = error.response?.status || 500;
    console.log(`Avatar proxy basarisiz: ${status}`);
    res.status(status).send('Avatar alinamadi');
  }
});

// TikTok profil bilgisini getir
app.get('/api/profile', async (req, res) => {
  const username = cleanUsername(req.query.username);

  if (!username) {
    return res.status(400).json({ error: 'Username gerekli' });
  }

  const cached = profileResultCache.get(username);
  if (cached && Date.now() - cached.savedAt < PROFILE_CACHE_TTL) {
    return res.json({ success: true, user: cached.user, method: 'cache' });
  }

  console.log(`Profil isteniyor: ${username}`);

  const methods = [
    ['profile-page', fetchProfilePage],
    ['tiktok-api', fetchProfileApi],
    ['oembed', fetchOembed]
  ];

  for (const [method, fetcher] of methods) {
    try {
      const user = await fetcher(username);
      if (user?.uniqueId) {
        console.log(`Profil bulundu (${method}): @${user.uniqueId}`);
        profileResultCache.set(username, { user, savedAt: Date.now() });
        return res.json({ success: true, user, method });
      }
    } catch (error) {
      const status = error.response?.status ? `HTTP ${error.response.status}` : error.message;
      console.log(`${method} basarisiz: ${status}`);
    }
  }

  return res.status(404).json({
    success: false,
    error: 'Profil bulunamadi veya TikTok istegi engelledi'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend calisiyor', port: PORT });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend calisiyor: http://localhost:${PORT}`);
    console.log(`Profil API: http://localhost:${PORT}/api/profile?username=tiktok`);
  });
}

module.exports = app;
