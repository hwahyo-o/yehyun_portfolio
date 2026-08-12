const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, keys: new Map() };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const response = await route(request, env);
    return withCors(response, origin, env);
  },
};

async function route(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const url = new URL(request.url);
  try {
    if (url.pathname === '/health') return json({ ok: true, service: 'yehyun-portfolio-api' });
    if (url.pathname === '/api/admin/drive/start' && request.method === 'GET') return startGoogleDriveOAuth(request, env);
    if (url.pathname === '/oauth/google/callback' && request.method === 'GET') return finishGoogleDriveOAuth(request, env);
    if (url.pathname === '/api/posts' && request.method === 'GET') return listPosts(request, env);
    if (url.pathname.startsWith('/api/posts/') && request.method === 'GET') {
      return getPost(request, env, url.pathname.split('/').pop());
    }
    if (url.pathname === '/api/updates' && request.method === 'GET') return listUpdates(env);
    if (url.pathname === '/api/guestbook' && request.method === 'GET') return listGuestbook(env);
    if (url.pathname === '/api/guestbook' && request.method === 'POST') return createGuestbook(request, env);
    if (url.pathname.startsWith('/api/media/') && request.method === 'GET') {
      const [, , , postId, mediaId] = url.pathname.split('/');
      return streamDriveMedia(request, env, postId, mediaId);
    }
    if (url.pathname.startsWith('/api/conversations/') && url.pathname.endsWith('/messages')) {
      const conversationId = url.pathname.split('/')[3];
      return request.method === 'GET'
        ? listMessages(env, conversationId)
        : createMessage(request, env, conversationId);
    }
    if (url.pathname.startsWith('/api/admin/')) {
      await requireAdmin(request, env);
      return json({ error: { code: 'ADMIN_WRITE_PENDING', message: '관리자 CMS 연결 단계입니다.' } }, 501);
    }
    return json({ error: { code: 'NOT_FOUND', message: '요청 경로를 찾을 수 없습니다.' } }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.publicMessage || '서버 오류가 발생했습니다.' } }, error.status || 500);
  }
}

async function listPosts(request, env) {
  const isAdmin = await optionalAdmin(request, env);
  const query = isAdmin
    ? 'SELECT id, type, title, description, body_html, is_private, status, content_path, published_at FROM posts WHERE deleted_at IS NULL ORDER BY published_at DESC LIMIT 100'
    : 'SELECT id, type, title, description, body_html, is_private, status, content_path, published_at FROM posts WHERE deleted_at IS NULL AND status = \'published\' AND is_private = 0 ORDER BY published_at DESC LIMIT 100';
  const result = await env.DB.prepare(query).all();
  return json({ items: result.results || [] });
}

async function getPost(request, env, postId) {
  const isAdmin = await optionalAdmin(request, env);
  const row = await env.DB.prepare('SELECT id, type, title, description, body_html, is_private, status, content_path, published_at FROM posts WHERE id = ? AND deleted_at IS NULL').bind(postId).first();
  if (!row || (!isAdmin && (row.status !== 'published' || row.is_private))) {
    return json({ error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' } }, 404);
  }
  const media = await env.DB.prepare('SELECT id, file_name, mime_type, size_bytes, content_url FROM post_media WHERE post_id = ? ORDER BY file_name').bind(postId).all();
  const origin = new URL(request.url).origin;
  return json({ item: { ...row, media: (media.results || []).map((file) => ({ ...file, url: file.content_url || `${origin}/api/media/${postId}/${file.id}` })) } });
}

async function listUpdates(env) {
  const result = await env.DB.prepare('SELECT id, title, description, published_at AS date FROM updates WHERE deleted_at IS NULL ORDER BY published_at DESC LIMIT 50').all();
  return json({ items: result.results || [] });
}

async function listGuestbook(env) {
  const result = await env.DB.prepare('SELECT id, name, content, created_at AS date FROM guestbook_comments WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10').all();
  return json({ items: result.results || [] });
}

async function createGuestbook(request, env) {
  const body = await request.json();
  const name = cleanText(body.name, 30);
  const password = String(body.password || '');
  const content = cleanText(body.content, 1000);
  if (!name || password.length < 4 || password.length > 64 || !content) {
    return json({ error: { code: 'INVALID_INPUT', message: '닉네임, 비밀번호, 메시지를 확인해주세요.' } }, 400);
  }
  const id = crypto.randomUUID();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO guestbook_comments (id, name, password_salt, password_hash, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, name, encode(salt), hash, content, now).run();
  return json({ item: { id, name, content, date: now } }, 201);
}

async function listMessages(env, conversationId) {
  if (!isSafeId(conversationId)) return json({ error: { code: 'INVALID_ID', message: '대화 ID가 올바르지 않습니다.' } }, 400);
  const result = await env.DB.prepare('SELECT id, sender, content, created_at AS date FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100').bind(conversationId).all();
  return json({ items: result.results || [] });
}

async function createMessage(request, env, conversationId) {
  if (!isSafeId(conversationId)) return json({ error: { code: 'INVALID_ID', message: '대화 ID가 올바르지 않습니다.' } }, 400);
  const body = await request.json();
  const content = cleanText(body.message, 1000);
  if (!content) return json({ error: { code: 'INVALID_INPUT', message: '메시지를 입력해주세요.' } }, 400);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').bind(conversationId, now, now),
    env.DB.prepare('INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, \'visitor\', ?, ?)').bind(crypto.randomUUID(), conversationId, content, now),
    env.DB.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId),
  ]);
  return json({ ok: true }, 201);
}

async function startGoogleDriveOAuth(request, env) {
  const claims = await requireAdmin(request, env);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw httpError('GOOGLE_OAUTH_NOT_CONFIGURED', 'Google OAuth 설정이 필요합니다.', 503);
  }
  const state = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO google_oauth_states (state, uid, created_at) VALUES (?, ?, ?)')
    .bind(state, claims.sub, new Date().toISOString()).run();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/drive.file',
    state,
  });
  return new Response(null, { status: 302, headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } });
}

async function finishGoogleDriveOAuth(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!state || !code) return oauthRedirect(env, 'admin-drive-error');
  const stateRow = await env.DB.prepare('SELECT state, uid, created_at FROM google_oauth_states WHERE state = ?').bind(state).first();
  if (!stateRow || Date.now() - Date.parse(stateRow.created_at) > 10 * 60 * 1000) return oauthRedirect(env, 'admin-drive-expired');
  await env.DB.prepare('DELETE FROM google_oauth_states WHERE state = ?').bind(state).run();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.GOOGLE_REDIRECT_URI || '',
    }),
  });
  if (!tokenResponse.ok) return oauthRedirect(env, 'admin-drive-token-error');
  const token = await tokenResponse.json();
  if (!token.refresh_token || !env.GOOGLE_TOKEN_ENCRYPTION_KEY) return oauthRedirect(env, 'admin-drive-secret-error');
  const encrypted = await encryptSecret(token.refresh_token, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO google_drive_connections (id, uid, google_subject, refresh_token_ciphertext, refresh_token_iv, created_at, updated_at)
    VALUES ('primary', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET uid = excluded.uid, google_subject = excluded.google_subject, refresh_token_ciphertext = excluded.refresh_token_ciphertext, refresh_token_iv = excluded.refresh_token_iv, updated_at = excluded.updated_at`)
    .bind(stateRow.uid, token.id_token || null, encrypted.ciphertext, encrypted.iv, now, now).run();
  return oauthRedirect(env, 'admin-drive-connected');
}

function oauthRedirect(env, status) {
  const origin = env.ALLOWED_ORIGIN || 'https://hwahyo-o.github.io/yehyun_portfolio';
  return new Response(null, { status: 302, headers: { Location: `${origin}/#${status}` } });
}

async function encryptSecret(value, encodedKey) {
  const key = await crypto.subtle.importKey('raw', decodeBytes(encodedKey), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return { ciphertext: encode(new Uint8Array(ciphertext)), iv: encode(iv) };
}

async function decryptSecret(ciphertext, iv, encodedKey) {
  const key = await crypto.subtle.importKey('raw', decodeBytes(encodedKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBytes(iv) }, key, decodeBytes(ciphertext));
  return new TextDecoder().decode(plaintext);
}

async function streamDriveMedia(request, env, postId, mediaId) {
  const isAdmin = await optionalAdmin(request, env);
  const row = await env.DB.prepare('SELECT p.status, p.is_private, m.drive_file_id, m.mime_type, m.file_name FROM posts p JOIN post_media m ON m.post_id = p.id WHERE p.id = ? AND m.id = ? AND p.deleted_at IS NULL').bind(postId, mediaId).first();
  if (!row || (!isAdmin && (row.status !== 'published' || row.is_private)) || !row.drive_file_id) {
    return json({ error: { code: 'NOT_FOUND', message: '미디어를 찾을 수 없습니다.' } }, 404);
  }
  const accessToken = await getDriveAccessToken(env);
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);
  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?alt=media`, { headers });
  if (!driveResponse.ok) return json({ error: { code: 'DRIVE_READ_FAILED', message: '미디어를 불러오지 못했습니다.' } }, 502);
  const responseHeaders = new Headers({
    'Content-Type': row.mime_type,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    'Cache-Control': row.status === 'published' && !row.is_private ? 'public, max-age=300' : 'private, no-store',
  });
  for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag']) {
    const value = driveResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(driveResponse.body, { status: driveResponse.status, headers: responseHeaders });
}

async function getDriveAccessToken(env) {
  let refreshToken = env.GOOGLE_REFRESH_TOKEN || '';
  if (!refreshToken && env.GOOGLE_TOKEN_ENCRYPTION_KEY && env.DB) {
    const connection = await env.DB.prepare('SELECT refresh_token_ciphertext, refresh_token_iv FROM google_drive_connections WHERE id = ?').bind('primary').first();
    if (connection) refreshToken = await decryptSecret(connection.refresh_token_ciphertext, connection.refresh_token_iv, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !refreshToken) {
    throw httpError('DRIVE_NOT_CONFIGURED', 'Google Drive 연결 설정이 필요합니다.', 503);
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw httpError('DRIVE_AUTH_FAILED', 'Google Drive 인증을 갱신하지 못했습니다.', 502);
  const payload = await response.json();
  return payload.access_token;
}

async function requireAdmin(request, env) {
  const token = getBearer(request);
  if (!token) throw httpError('AUTH_REQUIRED', '관리자 인증이 필요합니다.', 401);
  const claims = await verifyFirebaseToken(token, env);
  const allowed = env.ADMIN_UIDS ? env.ADMIN_UIDS.split(',').map((uid) => uid.trim()).includes(claims.sub) : await env.DB.prepare('SELECT 1 FROM admin_roles WHERE uid = ?').bind(claims.sub).first();
  if (!allowed) throw httpError('FORBIDDEN', '관리자 권한이 없습니다.', 403);
  return claims;
}

async function optionalAdmin(request, env) {
  try {
    return await requireAdmin(request, env);
  } catch (error) {
    if (error.status === 401 || error.status === 403) return null;
    throw error;
  }
}

async function verifyFirebaseToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) throw httpError('INVALID_TOKEN', '인증 토큰이 올바르지 않습니다.', 401);
  const header = JSON.parse(decode(parts[0]));
  const claims = JSON.parse(decode(parts[1]));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) {
    throw httpError('INVALID_TOKEN', '인증 토큰 알고리즘이 올바르지 않습니다.', 401);
  }
  if (!claims.sub || claims.aud !== env.FIREBASE_PROJECT_ID || claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || claims.exp <= now) {
    throw httpError('INVALID_TOKEN', '인증 토큰이 만료되었거나 올바르지 않습니다.', 401);
  }
  const keys = await getFirebaseCertificates();
  const certificate = keys.get(header.kid);
  if (!certificate) throw httpError('INVALID_TOKEN', '인증서가 올바르지 않습니다.', 401);
  const verified = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, certificate, decodeBytes(parts[2]), decodeBytes(parts[0] + '.' + parts[1]));
  if (!verified) throw httpError('INVALID_TOKEN', '인증 토큰 서명이 올바르지 않습니다.', 401);
  return claims;
}

async function getFirebaseCertificates() {
  if (certificateCache.expiresAt > Date.now()) return certificateCache.keys;
  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) throw httpError('CERTS_UNAVAILABLE', '인증서를 불러오지 못했습니다.', 503);
  const payload = await response.json();
  const keys = new Map();
  await Promise.all((payload.keys || []).map(async (jwk) => keys.set(jwk.kid, await importJwk(jwk))));
  const maxAge = Number((response.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, keys };
  return keys;
}

async function importJwk(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

function decode(value) {
  return new TextDecoder().decode(decodeBytes(value));
}

function decodeBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, material, 256);
  return encode(new Uint8Array(bits));
}

function encode(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, maxLength);
}

function isSafeId(value) {
  return /^[A-Za-z0-9_-]{8,100}$/.test(value);
}

function getBearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function httpError(code, publicMessage, status) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = publicMessage;
  error.status = status;
  return error;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function withCors(response, origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://hwahyo-o.github.io';
  const headers = new Headers(response.headers);
  if (origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  return new Response(response.body, { status: response.status, headers });
}
