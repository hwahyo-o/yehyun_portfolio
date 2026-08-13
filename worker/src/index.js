const FIRESTORE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
let firestoreTokenCache = { accessToken: '', expiresAt: 0 };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const visitorId = readCookie(request, 'portfolio_visitor_id') || crypto.randomUUID();
    const response = await route(request, env, ctx, visitorId);
    return withVisitorCookie(withCors(response, origin, env), visitorId);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runActivityBackup(env));
  },
};

async function route(request, env, ctx, visitorId) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const url = new URL(request.url);
  try {
    if (url.pathname === '/health') return json({ ok: true, service: 'yehyun-portfolio-api' });
    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const user = getBearer(request) ? await requireUser(request, env) : null;
      return json({ user: user && { uid: user.claims.sub, role: user.role } });
    }
    if (url.pathname === '/api/admin/drive/start' && request.method === 'GET') return startGoogleDriveOAuth(request, env);
    if (url.pathname === '/oauth/google/callback' && request.method === 'GET') return finishGoogleDriveOAuth(request, env);
    if (url.pathname === '/api/posts' && request.method === 'GET') return listPosts(request, env);
    if (url.pathname.startsWith('/api/posts/') && request.method === 'GET') {
      return getPost(request, env, url.pathname.split('/').pop());
    }
    if (url.pathname === '/api/updates' && request.method === 'GET') return listUpdates(env);
    if (url.pathname === '/api/guestbook' && request.method === 'GET') return listGuestbook(env);
    if (url.pathname === '/api/guestbook' && request.method === 'POST') {
      requireCsrfHeader(request);
      return createGuestbook(request, env, ctx);
    }
    if (url.pathname.startsWith('/api/media/') && request.method === 'GET') {
      const [, , , postId, mediaId] = url.pathname.split('/');
      return streamDriveMedia(request, env, postId, mediaId);
    }
    if (url.pathname.startsWith('/api/conversations/') && url.pathname.endsWith('/messages')) {
      const conversationId = url.pathname.split('/')[3];
      if (request.method !== 'GET') requireCsrfHeader(request);
      return request.method === 'GET' ? listMessages(request, env, conversationId) : createMessage(request, env, conversationId, ctx);
    }
    if (url.pathname === '/api/events' && request.method === 'POST') {
      requireCsrfHeader(request);
      return recordPublicEvent(request, env, visitorId, ctx);
    }
    if (url.pathname.startsWith('/api/guestbook/') && ['PATCH', 'DELETE'].includes(request.method)) {
      requireCsrfHeader(request);
      const commentId = url.pathname.split('/').pop();
      return request.method === 'PATCH' ? updateGuestbook(request, env, commentId) : deleteGuestbook(request, env, commentId);
    }
    if (url.pathname === '/api/admin/drive/status' && request.method === 'GET') {
      await requireAdmin(request, env);
      return getDriveStatus(env);
    }
    if (url.pathname === '/api/admin/drive/disconnect' && request.method === 'POST') {
      await requireAdmin(request, env);
      return disconnectDrive(env);
    }
    if (url.pathname === '/api/admin/notifications' && request.method === 'GET') {
      await requireAdmin(request, env);
      return listAdminNotifications(env);
    }
    if (url.pathname === '/api/admin/notifications/read' && request.method === 'POST') {
      await requireAdmin(request, env);
      return markAdminNotificationsRead(env);
    }
    if (url.pathname === '/api/admin/backups' && request.method === 'GET') {
      await requireAdmin(request, env);
      return listBackups(env);
    }
    if (url.pathname === '/api/admin/backups' && request.method === 'POST') {
      await requireAdmin(request, env);
      return createBackup(request, env);
    }
    if (url.pathname === '/api/admin/posts' && request.method === 'GET') {
      await requireAdmin(request, env);
      return listAdminPosts(env);
    }
    if (url.pathname === '/api/admin/posts' && request.method === 'POST') {
      const claims = await requireAdmin(request, env);
      return createAdminPost(request, env, claims);
    }
    if (url.pathname.startsWith('/api/admin/posts/') && request.method === 'PATCH') {
      await requireAdmin(request, env);
      return updateAdminPost(request, env, url.pathname.split('/').pop());
    }
    if (url.pathname.startsWith('/api/admin/posts/') && request.method === 'DELETE') {
      const claims = await requireAdmin(request, env);
      return deleteAdminPost(request, env, url.pathname.split('/').pop(), claims);
    }
    if (url.pathname.startsWith('/api/admin/backups/') && url.pathname.endsWith('/download') && request.method === 'GET') {
      await requireAdmin(request, env);
      return downloadBackup(env, url.pathname.split('/')[4]);
    }
    if (url.pathname.startsWith('/api/admin/backups/') && url.pathname.endsWith('/restore') && request.method === 'POST') {
      await requireAdmin(request, env);
      return restoreBackup(env, url.pathname.split('/')[4]);
    }
    if (url.pathname.startsWith('/api/admin/')) {
      await requireAdmin(request, env);
      return json({ error: { code: 'ADMIN_WRITE_PENDING', message: '해당 관리자 기능은 아직 연결되지 않았습니다.' } }, 501);
    }
    return json({ error: { code: 'NOT_FOUND', message: '요청 경로를 찾을 수 없습니다.' } }, 404);
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR';
    console.error('request_failed', { code, status: error.status || 500 });
    return json({ error: { code, message: error.publicMessage || publicMessageForCode(code) } }, error.status || 500);
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
  return json({ item: { ...row, media: (media.results || []).map((file) => ({ ...file, url: file.content_url ? (file.content_url.startsWith('http') ? file.content_url : origin + file.content_url) : `${origin}/api/media/${postId}/${file.id}` })) } });
}

async function listAdminPosts(env) {
  const result = await env.DB.prepare(
    'SELECT id, type, title, description, body_html, is_private, status, content_path, published_at, created_at, updated_at FROM posts WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100',
  ).all();
  return json({ items: result.results || [] });
}

async function createAdminPost(request, env, claims) {
  const { input, mediaFiles } = await readPostInput(request);
  const totalUploadBytes = sourceByteLength(input) + mediaFiles.reduce((sum, item) => sum + item.sizeBytes, 0);
  if (totalUploadBytes > 150 * 1024 * 1024) {
    throw httpError('INVALID_MEDIA', '게시물 전체 용량은 150MB까지입니다.', 400);
  }
  if (!env.GITHUB_CONTENT_TOKEN || !env.GITHUB_REPOSITORY) {
    throw httpError('CONTENT_PUBLISH_NOT_CONFIGURED', 'Content 배포 설정이 필요합니다.', 503);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const folder = buildKstContentFolder(now, input.title, id);
  const contentPath = 'Content/' + folder;
  const jobId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO posts (id, type, title, description, body_html, is_private, status, content_path, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.type, input.title, input.description, input.html, input.isPrivate ? 1 : 0, 'backup_pending', contentPath, null, now, now),
    env.DB.prepare('INSERT INTO upload_jobs (id, post_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(jobId, id, 'pending', now, now),
  ]);

  try {
    const drive = await uploadDrivePostAssets(env, id, input.title, now, input, mediaFiles);
    const origin = new URL(request.url).origin;
    const renderedHtml = rewriteMediaReferences(input.html, drive.mediaRows, origin);
    const manifest = drive.mediaRows.map((item) => ({
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      url: item.contentUrl,
    }));
    await env.DB.batch([
      ...drive.mediaRows.map((item) => env.DB.prepare('INSERT INTO post_media (id, post_id, file_name, mime_type, size_bytes, drive_file_id, content_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(item.id, id, item.fileName, item.mimeType, item.sizeBytes, item.driveFileId, item.contentUrl, now)),
      env.DB.prepare('UPDATE posts SET body_html = ?, updated_at = ? WHERE id = ?').bind(renderedHtml, new Date().toISOString(), id),
      env.DB.prepare("UPDATE upload_jobs SET status = 'drive_backed_up', drive_folder_id = ?, updated_at = ? WHERE id = ?").bind(drive.folderId, new Date().toISOString(), jobId),
    ]);

    const files = [
      { path: contentPath + '/index.html', value: renderedHtml },
      { path: contentPath + '/style.css', value: input.css },
      { path: contentPath + '/script.js', value: input.js },
      { path: contentPath + '/media-manifest.json', value: JSON.stringify(manifest) },
    ];
    let commitSha = '';
    for (const file of files) {
      commitSha = await putGitHubContent(env, file.path, file.value, 'content: publish ' + id);
    }
    const publishedAt = input.status === 'published' ? new Date().toISOString() : null;
    await env.DB.batch([
      env.DB.prepare("UPDATE upload_jobs SET status = 'content_committed', github_commit_sha = ?, updated_at = ? WHERE id = ?").bind(commitSha, new Date().toISOString(), jobId),
      env.DB.prepare("UPDATE posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?").bind(input.status, publishedAt, new Date().toISOString(), id),
      env.DB.prepare('INSERT INTO audit_logs (id, uid, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), claims.sub, 'content_publish', 'post', id, new Date().toISOString()),
    ]);
    return json({ item: { id, contentPath, status: input.status, media: manifest }, uploadJobId: jobId }, 201);
  } catch (error) {
    await env.DB.prepare("UPDATE upload_jobs SET status = 'failed', error_code = ?, updated_at = ? WHERE id = ?")
      .bind(error.code || 'CONTENT_PUBLISH_FAILED', new Date().toISOString(), jobId).run();
    await env.DB.prepare("UPDATE posts SET status = 'draft', published_at = NULL, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    if (error.code === 'DRIVE_NOT_CONFIGURED' || error.code === 'DRIVE_AUTH_FAILED') throw error;
    throw httpError('CONTENT_PUBLISH_FAILED', 'Content 배포에 실패했습니다. 업로드 상태를 확인해주세요.', 502);
  }
}

async function readPostInput(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    const body = await request.json().catch(() => ({}));
    return { input: validatePostInput(body), mediaFiles: [] };
  }
  const form = await request.formData();
  const body = {
    type: form.get('type'),
    title: form.get('title'),
    description: form.get('description'),
    html: form.get('html'),
    css: form.get('css'),
    js: form.get('js'),
    status: form.get('status'),
    isPrivate: form.get('isPrivate') === 'on',
    media: [],
  };
  const files = form.getAll('media').filter((value) => value && typeof value.arrayBuffer === 'function' && typeof value.name === 'string');
  return { input: validatePostInput(body), mediaFiles: validateMediaFiles(files) };
}

function sourceByteLength(input) {
  return new TextEncoder().encode(input.html).byteLength
    + new TextEncoder().encode(input.css).byteLength
    + new TextEncoder().encode(input.js).byteLength;
}

function validateMediaFiles(files) {
  const imageFiles = files.filter((file) => String(file.type || '').toLowerCase().startsWith('image/'));
  const videoFiles = files.filter((file) => String(file.type || '').toLowerCase().startsWith('video/'));
  if (files.length > 20) throw httpError('INVALID_MEDIA', '미디어 파일은 게시물당 20개까지 업로드할 수 있습니다.', 400);
  if (imageFiles.length > 10) throw httpError('INVALID_MEDIA', '이미지는 게시물당 최대 10개까지 업로드할 수 있습니다.', 400);
  if (videoFiles.length > 5) throw httpError('INVALID_MEDIA', '동영상은 게시물당 최대 5개까지 업로드할 수 있습니다.', 400);

  let total = 0;
  let imageTotal = 0;
  let videoTotal = 0;
  const result = files.map((file) => {
    const name = cleanFileName(file.name);
    const mimeType = String(file.type || '').toLowerCase();
    const sizeBytes = Number(file.size) || 0;
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) throw httpError('INVALID_MEDIA', '이미지와 동영상만 업로드할 수 있습니다.', 400);
    if (!sizeBytes) throw httpError('INVALID_MEDIA', '빈 미디어 파일은 업로드할 수 없습니다.', 400);
    total += sizeBytes;
    if (mimeType.startsWith('image/')) imageTotal += sizeBytes;
    if (mimeType.startsWith('video/')) videoTotal += sizeBytes;
    return { file, fileName: name, mimeType, sizeBytes };
  });

  const mixed = imageFiles.length > 0 && videoFiles.length > 0;
  const mediaLimit = mixed ? 120 * 1024 * 1024 : 100 * 1024 * 1024;
  if (imageTotal > 100 * 1024 * 1024) throw httpError('INVALID_MEDIA', '이미지 전체 용량은 100MB까지입니다.', 400);
  if (videoTotal > 100 * 1024 * 1024) throw httpError('INVALID_MEDIA', '동영상 전체 용량은 100MB까지입니다.', 400);
  if (total > mediaLimit) throw httpError('INVALID_MEDIA', mixed ? '이미지와 동영상 혼합 업로드는 120MB까지입니다.' : '미디어 업로드는 100MB까지입니다.', 400);
  return result;
}

async function uploadDrivePostAssets(env, postId, title, iso, input, mediaFiles) {
  const token = await getDriveAccessToken(env);
  const root = await env.DB.prepare('SELECT drive_folder_id FROM drive_storage_roots WHERE id = ?').bind('primary').first();
  if (!root?.drive_folder_id) throw httpError('DRIVE_NOT_READY', 'Google Drive 백업 폴더를 먼저 준비해주세요.', 409);
  const dateId = await getOrCreateDriveFolder(token, kstDateFolder(iso), root.drive_folder_id);
  const postIdFolder = await getOrCreateDriveFolder(token, slugify(title), dateId);
  const originals = [
    { fileName: 'index.html', mimeType: 'text/html; charset=utf-8', bytes: new TextEncoder().encode(input.html) },
    { fileName: 'style.css', mimeType: 'text/css; charset=utf-8', bytes: new TextEncoder().encode(input.css) },
    { fileName: 'script.js', mimeType: 'text/javascript; charset=utf-8', bytes: new TextEncoder().encode(input.js) },
  ];
  for (const original of originals) {
    await uploadDriveFile(token, original.fileName, original.mimeType, original.bytes, postIdFolder);
  }
  const mediaRows = [];
  for (const item of mediaFiles) {
    const id = crypto.randomUUID();
    const driveFile = await uploadDriveFile(token, item.fileName, item.mimeType, await item.file.arrayBuffer(), postIdFolder);
    mediaRows.push({
      id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      driveFileId: driveFile.id,
      contentUrl: '/api/media/' + postId + '/' + id,
    });
  }
  return { folderId: postIdFolder, mediaRows };
}

function rewriteMediaReferences(source, mediaRows, origin) {
  return mediaRows.reduce((value, item) => value.split(item.fileName).join(origin + item.contentUrl), source);
}

function kstDateFolder(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function updateAdminPost(request, env, postId) {
  if (!isSafeId(postId)) return json({ error: { code: 'INVALID_ID', message: '게시물 ID가 올바르지 않습니다.' } }, 400);
  const body = await request.json().catch(() => ({}));
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 2000);
  const type = ['Graphic', 'UX/UI', 'Video'].includes(body.type) ? body.type : null;
  if (!title || !type) return json({ error: { code: 'INVALID_INPUT', message: '게시물 정보를 확인해주세요.' } }, 400);
  const row = await env.DB.prepare('SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL').bind(postId).first();
  if (!row) return json({ error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' } }, 404);
  await env.DB.prepare('UPDATE posts SET title = ?, description = ?, type = ?, updated_at = ? WHERE id = ?')
    .bind(title, description, type, new Date().toISOString(), postId).run();
  return json({ ok: true });
}

async function deleteAdminPost(request, env, postId, claims) {
  if (!isSafeId(postId)) return json({ error: { code: 'INVALID_ID', message: '게시물 ID가 올바르지 않습니다.' } }, 400);
  const row = await env.DB.prepare('SELECT id, title FROM posts WHERE id = ? AND deleted_at IS NULL').bind(postId).first();
  if (!row) return json({ error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' } }, 404);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE posts SET deleted_at = ?, status = 'deleted', updated_at = ? WHERE id = ?").bind(now, now, postId),
    env.DB.prepare('INSERT INTO audit_logs (id, uid, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), claims.sub, 'post_delete', 'post', postId, now),
  ]);
  return json({ ok: true, deletedAt: now });
}

function validatePostInput(body) {
  const type = ['Graphic', 'UX/UI', 'Video'].includes(body.type) ? body.type : '';
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 2000);
  const html = String(body.html || '');
  const css = String(body.css || '');
  const js = String(body.js || '');
  const status = body.status === 'published' ? 'published' : 'draft';
  const isPrivate = Boolean(body.isPrivate);
  const media = Array.isArray(body.media) ? body.media.slice(0, 20).map((item) => ({
    fileName: cleanFileName(item.fileName),
    mimeType: cleanText(item.mimeType, 100),
    sizeBytes: Number(item.sizeBytes) || 0,
    url: cleanMediaUrl(item.url),
  })) : [];
  if (!type || !title || !html || html.length > 200000 || css.length > 200000 || js.length > 200000) {
    throw httpError('INVALID_INPUT', '게시물 정보 또는 파일 크기를 확인해주세요.', 400);
  }
  const sourceBytes = new TextEncoder().encode(html).byteLength
    + new TextEncoder().encode(css).byteLength
    + new TextEncoder().encode(js).byteLength;
  if (sourceBytes > 150 * 1024 * 1024) {
    throw httpError('INVALID_INPUT', '게시물 전체 용량은 150MB까지입니다.', 400);
  }
  assertRelativeAssetReferences(html, css, js);
  return { type, title, description, html, css, js, status, isPrivate, media };
}

function cleanFileName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 120 || /[\\/\0\x00-\x1F]/.test(name) || name === '.' || name === '..') {
    throw httpError('INVALID_FILE_NAME', '파일명이 올바르지 않습니다.', 400);
  }
  return name;
}

function cleanMediaUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  if (!url.startsWith('/api/media/')) throw httpError('INVALID_MEDIA_URL', '미디어 URL은 Worker 경로만 사용할 수 있습니다.', 400);
  return url.slice(0, 300);
}

function assertRelativeAssetReferences(html, css, js) {
  const source = html + '\n' + css + '\n' + js;
  if (/<script[^>]+src\s*=\s*["'](?:https?:|\/\/)/i.test(html)
    || /<(?:iframe|object|embed)\b/i.test(html)
    || /\s(?:src|href|action)\s*=\s*["'](?:https?:|\/\/|javascript:)/i.test(source)
    || /\son[a-z]+\s*=/i.test(source)
    || /javascript:/i.test(source)) {
    throw httpError('UNSAFE_CONTENT', '외부 실행 코드 또는 위험한 HTML을 사용할 수 없습니다.', 400);
  }
  if (/(?:^|[("'=])\s*\.\.(?:[/"')?#]|$)/m.test(source)) {
    throw httpError('UNSAFE_CONTENT', '상위 경로 참조는 사용할 수 없습니다.', 400);
  }
}

function buildKstContentFolder(iso, title, id) {
  const date = new Date(iso);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const stamp = kst.toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-') + '_KST';
  const slug = slugify(title) + '-' + id.slice(0, 8);
  return stamp + '/' + slug;
}

function slugify(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
}

async function putGitHubContent(env, path, content, message) {
  const [owner, repo] = String(env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repo || !env.GITHUB_CONTENT_TOKEN) throw httpError('CONTENT_PUBLISH_NOT_CONFIGURED', 'Content 배포 설정이 필요합니다.', 503);
  const response = await fetch('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + env.GITHUB_CONTENT_TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'yehyun-portfolio-worker',
    },
    body: JSON.stringify({ message, content: encodeText(content), branch: env.GITHUB_BRANCH || 'main' }),
  });
  if (!response.ok) throw httpError('GITHUB_CONTENT_FAILED', 'GitHub Content 커밋에 실패했습니다.', 502);
  const payload = await response.json();
  return payload.commit?.sha || '';
}

async function listUpdates(env) {
  const result = await env.DB.prepare('SELECT id, title, description, published_at AS date FROM updates WHERE deleted_at IS NULL ORDER BY published_at DESC LIMIT 50').all();
  return json({ items: result.results || [] });
}

async function listGuestbook(env) {
  const result = await env.DB.prepare('SELECT id, name, author_uid, content, created_at AS date FROM guestbook_comments WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10').all();
  const items = result.results || [];
  if (!items.length) return json({ items: [] });
  const placeholders = items.map(() => '?').join(', ');
  const replies = await env.DB.prepare(
    'SELECT id, comment_id, content, author_type, author_name, created_at AS date FROM guestbook_replies WHERE deleted_at IS NULL AND comment_id IN (' + placeholders + ') ORDER BY created_at ASC',
  ).bind(...items.map((item) => item.id)).all();
  const repliesByComment = new Map();
  (replies.results || []).forEach((reply) => {
    const list = repliesByComment.get(reply.comment_id) || [];
    list.push(reply);
    repliesByComment.set(reply.comment_id, list);
  });
  return json({
    items: items.map((item) => ({ ...item, replies: repliesByComment.get(item.id) || [] })),
  });
}

async function createGuestbook(request, env, ctx) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const name = cleanText(body.name, 30);
  const content = cleanText(body.content, 1000);
  if (!name || !content) return json({ error: { code: 'INVALID_INPUT', message: '닉네임과 메시지를 확인해주세요.' } }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare('INSERT INTO guestbook_comments (id, name, author_uid, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, user.claims.sub, content, now).run();
  await recordActivity(env, { eventId: crypto.randomUUID(), actorId: user.claims.sub, actorType: user.role, action: 'guestbook.create', entityId: id, metadata: {} }, ctx);
  await recordNotification(env, 'guestbook', 'Guestbook 새 댓글', name + '님이 Guestbook에 댓글을 남겼습니다.', id);
  return json({ item: { id, name, author_uid: user.claims.sub, content, date: now } }, 201);
}

async function requireGuestbookOwner(request, env, commentId) {
  if (!isSafeId(commentId)) throw httpError('INVALID_ID', '방명록 ID가 올바르지 않습니다.', 400);
  const user = await requireUser(request, env);
  const row = await env.DB.prepare('SELECT author_uid FROM guestbook_comments WHERE id = ? AND deleted_at IS NULL').bind(commentId).first();
  if (!row) throw httpError('NOT_FOUND', '방명록을 찾을 수 없습니다.', 404);
  if (user.role !== 'admin' && (!row.author_uid || row.author_uid !== user.claims.sub)) throw httpError('FORBIDDEN', '본인이 작성한 방명록만 수정하거나 삭제할 수 있습니다.', 403);
  return user;
}

async function updateGuestbook(request, env, commentId) {
  await requireGuestbookOwner(request, env, commentId);
  const content = cleanText((await request.json()).content, 1000);
  if (!content) return json({ error: { code: 'INVALID_INPUT', message: '내용을 입력해주세요.' } }, 400);
  await env.DB.prepare('UPDATE guestbook_comments SET content = ? WHERE id = ?').bind(content, commentId).run();
  return json({ ok: true });
}

async function deleteGuestbook(request, env, commentId) {
  await requireGuestbookOwner(request, env, commentId);
  await env.DB.prepare('UPDATE guestbook_comments SET deleted_at = ? WHERE id = ?').bind(new Date().toISOString(), commentId).run();
  return json({ ok: true });
}

async function requireConversationOwner(request, env, conversationId) {
  if (!isSafeId(conversationId)) throw httpError('INVALID_ID', '대화 ID가 올바르지 않습니다.', 400);
  const user = await requireUser(request, env);
  const conversation = await env.DB.prepare('SELECT owner_uid FROM conversations WHERE id = ?').bind(conversationId).first();
  if (conversation && user.role !== 'admin' && conversation.owner_uid !== user.claims.sub) throw httpError('FORBIDDEN', '본인 대화만 확인할 수 있습니다.', 403);
  return { user, conversation };
}

async function listMessages(request, env, conversationId) {
  await requireConversationOwner(request, env, conversationId);
  const result = await env.DB.prepare('SELECT id, sender, content, created_at AS date FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100').bind(conversationId).all();
  return json({ items: result.results || [] });
}

async function createMessage(request, env, conversationId, ctx) {
  const { user, conversation } = await requireConversationOwner(request, env, conversationId);
  const content = cleanText((await request.json()).message, 1000);
  if (!content) return json({ error: { code: 'INVALID_INPUT', message: '메시지를 입력해주세요.' } }, 400);
  const now = new Date().toISOString();
  if (!conversation) await env.DB.prepare('INSERT INTO conversations (id, owner_uid, created_at, updated_at) VALUES (?, ?, ?, ?)').bind(conversationId, user.claims.sub, now, now).run();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), conversationId, user.role === 'admin' ? 'admin' : 'visitor', content, now),
    env.DB.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId),
  ]);
  await recordActivity(env, { eventId: crypto.randomUUID(), actorId: user.claims.sub, actorType: user.role, action: 'dm.create', entityId: conversationId, metadata: {} }, ctx);
  await recordNotification(env, 'dm', 'Direct Message 새 문의', 'Member가 새 메시지를 보냈습니다.', conversationId);
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
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  if ((request.headers.get('Accept') || '').includes('application/json')) return json({ authorizationUrl });
  return new Response(null, { status: 302, headers: { Location: authorizationUrl } });
}

async function finishGoogleDriveOAuth(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const providerError = url.searchParams.get('error') || '';
  if (providerError) return oauthRedirect(env, driveOAuthErrorFragment(providerError));
  if (!state || !code) return oauthRedirect(env, 'admin-drive-error');
  const stateRow = await env.DB.prepare('SELECT state, uid, created_at FROM google_oauth_states WHERE state = ?').bind(state).first();
  if (!stateRow || Date.now() - Date.parse(stateRow.created_at) > 10 * 60 * 1000) return oauthRedirect(env, 'admin-drive-expired');
  await env.DB.prepare('DELETE FROM google_oauth_states WHERE state = ?').bind(state).run();
  const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
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
  if (!tokenResponse.ok) {
    const failure = await tokenResponse.json().catch(() => ({}));
    return oauthRedirect(env, driveOAuthErrorFragment(failure.error));
  }
  const token = await tokenResponse.json();
  if (!token.refresh_token || !env.GOOGLE_TOKEN_ENCRYPTION_KEY) return oauthRedirect(env, 'admin-drive-secret-error');

  try {
    const encrypted = await encryptSecret(token.refresh_token, env.GOOGLE_TOKEN_ENCRYPTION_KEY);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO google_drive_connections (id, uid, google_subject, refresh_token_ciphertext, refresh_token_iv, created_at, updated_at)
      VALUES ('primary', ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET uid = excluded.uid, google_subject = NULL, refresh_token_ciphertext = excluded.refresh_token_ciphertext, refresh_token_iv = excluded.refresh_token_iv, updated_at = excluded.updated_at`)
      .bind(stateRow.uid, encrypted.ciphertext, encrypted.iv, now, now).run();

    const accessToken = await getDriveAccessToken(env);
    const rootId = await getOrCreateDriveFolder(accessToken, 'Portfolio-con');
    await getOrCreateDriveFolder(accessToken, 'Backups', rootId);
    await env.DB.prepare('INSERT INTO drive_storage_roots (id, drive_folder_id, verified_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET drive_folder_id = excluded.drive_folder_id, verified_at = excluded.verified_at')
      .bind('primary', rootId, new Date().toISOString()).run();
    return oauthRedirect(env, 'admin-drive-connected');
  } catch (error) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM google_drive_connections WHERE id = ?').bind('primary'),
      env.DB.prepare('DELETE FROM drive_storage_roots WHERE id = ?').bind('primary'),
    ]).catch(() => {});
    return oauthRedirect(env, driveErrorFragment(error.code));
  }
}

function driveErrorFragment(code) {
  const fragments = {
    AUTH_UPSTREAM_TIMEOUT: 'admin-drive-timeout',
    DRIVE_FOLDER_READ_FAILED: 'admin-drive-folder-read-error',
    DRIVE_FOLDER_CREATE_FAILED: 'admin-drive-folder-create-error',
    DRIVE_AUTH_FAILED: 'admin-drive-auth-error',
    DRIVE_NOT_CONFIGURED: 'admin-drive-secret-error',
    SECRET_CONFIG_INVALID: 'admin-drive-secret-error',
  };
  return fragments[code] || 'admin-drive-error';
}

function driveOAuthErrorFragment(code) {
  if (code === 'access_denied') return 'admin-drive-access-denied';
  if (code === 'redirect_uri_mismatch') return 'admin-drive-redirect-error';
  if (code === 'invalid_grant') return 'admin-drive-expired';
  return 'admin-drive-token-error';
}



function oauthRedirect(env, status) {
  const origin = env.FRONTEND_URL || 'https://hwahyo-o.github.io/yehyun_portfolio';
  return new Response(null, { status: 302, headers: { Location: `${origin}/#${status}` } });
}

function encryptionKeyBytes(encodedKey) {
  const value = String(encodedKey || '').trim();
  if (!value) throw httpError('SECRET_CONFIG_INVALID', '서버 보안 설정이 올바르지 않습니다.', 503);

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
  }

  try {
    const bytes = decodeBytes(value);
    if (bytes.length === 32) return bytes;
  } catch {
    // Try the exact-length UTF-8 form below.
  }

  const raw = new TextEncoder().encode(value);
  if (raw.length === 32) return raw;
  throw httpError('SECRET_CONFIG_INVALID', '서버 보안 설정이 올바르지 않습니다.', 503);
}

async function encryptSecret(value, encodedKey) {
  const key = await crypto.subtle.importKey('raw', encryptionKeyBytes(encodedKey), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return { ciphertext: encode(new Uint8Array(ciphertext)), iv: encode(iv) };
}

async function decryptSecret(ciphertext, iv, encodedKey) {
  const key = await crypto.subtle.importKey('raw', encryptionKeyBytes(encodedKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBytes(iv) }, key, decodeBytes(ciphertext));
  return new TextDecoder().decode(plaintext);
}

async function getDriveStatus(env) {
  const connection = await env.DB.prepare('SELECT google_subject, updated_at FROM google_drive_connections WHERE id = ?').bind('primary').first();
  const root = await env.DB.prepare('SELECT verified_at FROM drive_storage_roots WHERE id = ?').bind('primary').first();
  return json({ connected: Boolean(connection && root), ready: Boolean(root), updatedAt: connection?.updated_at || null, verifiedAt: root?.verified_at || null });
}

async function disconnectDrive(env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM google_drive_connections WHERE id = ?').bind('primary'),
    env.DB.prepare('DELETE FROM drive_storage_roots WHERE id = ?').bind('primary'),
  ]);
  return json({ ok: true });
}

async function listAdminNotifications(env) {
  const result = await env.DB.prepare('SELECT id, type, title, body, entity_id, created_at, read_at FROM admin_notifications ORDER BY created_at DESC LIMIT 50').all();
  const items = result.results || [];
  const expiring = await env.DB.prepare("SELECT id, title, deleted_at FROM posts WHERE deleted_at IS NOT NULL AND datetime(deleted_at) > datetime('now') AND datetime(deleted_at) <= datetime('now', '+1 day') LIMIT 20").all();
  (expiring.results || []).forEach((post) => {
    items.push({
      id: 'trash-expiring-' + post.id,
      type: 'trash_expiring',
      title: '휴지통 영구삭제 임박',
      body: (post.title || '게시물') + '의 영구삭제까지 1일 이내입니다.',
      entity_id: post.id,
      created_at: post.deleted_at,
      read_at: null,
    });
  });
  items.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  return json({ items: items.slice(0, 50) });
}

async function markAdminNotificationsRead(env) {
  await env.DB.prepare('UPDATE admin_notifications SET read_at = COALESCE(read_at, ?) WHERE read_at IS NULL').bind(new Date().toISOString()).run();
  return json({ ok: true });
}

async function listBackups(env) {
  const result = await env.DB.prepare('SELECT id, mode, file_name, size_bytes, created_at, restored_at FROM backups ORDER BY created_at DESC LIMIT 50').all();
  return json({ items: result.results || [] });
}

async function recordNotification(env, type, title, body, entityId = null) {
  await env.DB.prepare('INSERT INTO admin_notifications (id, type, title, body, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), type, title, body, entityId, new Date().toISOString()).run();
}

async function recordPublicEvent(request, env, visitorId, ctx) {
  const body = await request.json().catch(() => ({}));
  const action = ['post.view', 'content.share', 'content.reaction', 'guestbook.create', 'dm.create'].includes(body.action) ? body.action : '';
  if (!action) return json({ error: { code: 'INVALID_INPUT', message: '이벤트 종류가 올바르지 않습니다.' } }, 400);
  const user = action === 'post.view' ? await optionalUser(request, env) : await requireUser(request, env);
  await recordActivity(env, { eventId: String(body.eventId || crypto.randomUUID()), actorId: user?.claims.sub || visitorId, actorType: user?.role || 'guest', action, entityId: cleanText(body.entityId || body.postId, 100), metadata: {} }, ctx);
  if (['content.share', 'content.reaction'].includes(action)) await recordNotification(env, action === 'content.share' ? 'share' : 'reaction', action === 'content.share' ? '게시물 공유 알림' : '게시물 반응 알림', action === 'content.share' ? 'Member가 게시물을 공유했습니다.' : 'Member가 게시물에 반응을 남겼습니다.', cleanText(body.entityId || body.postId, 100));
  return json({ ok: true }, 201);
}

async function snapshotTable(env, table) {
  const result = await env.DB.prepare('SELECT * FROM ' + table).all();
  return result.results || [];
}

async function createBackup(request, env) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'auto' ? 'auto' : 'manual';
  const connection = await env.DB.prepare('SELECT id FROM google_drive_connections WHERE id = ?').bind('primary').first();
  if (!connection) throw httpError('DRIVE_NOT_CONNECTED', '먼저 Google Drive를 연결해주세요.', 409);
  const snapshot = {
    schemaVersion: 2,
    timezone: 'Asia/Seoul',
    createdAt: new Date().toISOString(),
    data: {
      posts: await snapshotTable(env, 'posts'),
      post_media: await snapshotTable(env, 'post_media'),
      updates: await snapshotTable(env, 'updates'),
      guestbook_comments: await snapshotTable(env, 'guestbook_comments'),
      guestbook_replies: await snapshotTable(env, 'guestbook_replies'),
      conversations: await snapshotTable(env, 'conversations'),
      messages: await snapshotTable(env, 'messages'),
      admin_notifications: await snapshotTable(env, 'admin_notifications'),
    },
  };
  const payload = JSON.stringify(snapshot);
  const token = await getDriveAccessToken(env);
  const rootId = await getOrCreateDriveFolder(token, 'Portfolio-con');
  const backupRootId = await getOrCreateDriveFolder(token, 'Backups', rootId);
  const dateFolder = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const dateFolderId = await getOrCreateDriveFolder(token, dateFolder, backupRootId);
  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', '_').replaceAll(':', '-');
  const fileName = 'portfolio_' + mode + '_' + timestamp + '_KST.json';
  const file = await uploadDriveJson(token, fileName, payload, dateFolderId);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO backups (id, mode, file_name, drive_file_id, drive_folder_id, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, mode, fileName, file.id, dateFolderId, new TextEncoder().encode(payload).byteLength, now).run();
  await recordNotification(env, 'backup', '백업 완료', fileName + ' 백업이 완료되었습니다.', id);
  return json({ item: { id, mode, file_name: fileName, created_at: now } }, 201);
}

async function findDriveFolder(token, name, parentId = null) {
  const q = ["name = '" + name.replaceAll("'", "\\'") + "'", "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
  if (parentId) q.push("'" + parentId + "' in parents");
  const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: q.join(' and '), pageSize: '1', fields: 'files(id,name)' });
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!response.ok) throw httpError('DRIVE_FOLDER_READ_FAILED', 'Google Drive 폴더를 확인하지 못했습니다.', 502);
  const payload = await response.json();
  return payload.files?.[0]?.id || null;
}

async function getOrCreateDriveFolder(token, name, parentId = null) {
  const existing = await findDriveFolder(token, name, parentId);
  if (existing) return existing;
  const metadata = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) throw httpError('DRIVE_FOLDER_CREATE_FAILED', 'Google Drive 폴더를 생성하지 못했습니다.', 502);
  const payload = await response.json();
  return payload.id;
}

async function uploadDriveFile(token, fileName, mimeType, bytes, parentId) {
  const boundary = 'portfolio_file_' + crypto.randomUUID();
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const header = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata
    + '\r\n--' + boundary + '\r\nContent-Type: ' + mimeType + '\r\n\r\n';
  const footer = '\r\n--' + boundary + '--';
  const body = new Blob([header, bytes, footer]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/related; boundary=' + boundary,
    },
    body,
  });
  if (!response.ok) throw httpError('DRIVE_UPLOAD_FAILED', '원본 파일을 Google Drive에 저장하지 못했습니다.', 502);
  return response.json();
}

async function uploadDriveJson(token, fileName, payload, parentId) {
  const boundary = 'portfolio_backup_boundary';
  const body = [
    '--' + boundary + '\r\n',
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify({ name: fileName, parents: [parentId], mimeType: 'application/json' }),
    '\r\n--' + boundary + '\r\n',
    'Content-Type: application/json\r\n\r\n',
    payload,
    '\r\n--' + boundary + '--',
  ].join('');
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/related; boundary=' + boundary,
    },
    body,
  });
  if (!response.ok) throw httpError('DRIVE_UPLOAD_FAILED', '백업 파일을 Google Drive에 저장하지 못했습니다.', 502);
  return response.json();
}

async function downloadDriveJson(token, fileId) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw httpError('DRIVE_DOWNLOAD_FAILED', '백업 파일을 불러오지 못했습니다.', 502);
  return response.json();
}

async function downloadBackup(env, backupId) {
  const row = await env.DB.prepare('SELECT file_name, drive_file_id FROM backups WHERE id = ?').bind(backupId).first();
  if (!row) return json({ error: { code: 'NOT_FOUND', message: '백업을 찾을 수 없습니다.' } }, 404);
  const token = await getDriveAccessToken(env);
  const response = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(row.drive_file_id) + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw httpError('DRIVE_DOWNLOAD_FAILED', '백업 파일을 다운로드하지 못했습니다.', 502);
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + row.file_name + '"' });
  return new Response(response.body, { status: 200, headers });
}

async function restoreBackup(env, backupId) {
  const row = await env.DB.prepare('SELECT drive_file_id FROM backups WHERE id = ?').bind(backupId).first();
  if (!row) return json({ error: { code: 'NOT_FOUND', message: '백업을 찾을 수 없습니다.' } }, 404);
  const snapshot = await downloadDriveJson(await getDriveAccessToken(env), row.drive_file_id);
  if (!snapshot || snapshot.schemaVersion !== 2 || !snapshot.data) throw httpError('INVALID_BACKUP', '복원할 수 없는 백업 파일입니다.', 400);
  const data = snapshot.data;
  const rows = (name) => Array.isArray(data[name]) ? data[name].slice(0, 10000) : [];
  const statements = [
    'DELETE FROM guestbook_replies', 'DELETE FROM guestbook_comments',
    'DELETE FROM messages', 'DELETE FROM conversations',
    'DELETE FROM post_media', 'DELETE FROM posts', 'DELETE FROM updates',
    'DELETE FROM admin_notifications',
  ].map((sql) => env.DB.prepare(sql));
  rows('posts').forEach((row) => statements.push(env.DB.prepare('INSERT INTO posts (id, type, title, description, body_html, is_private, status, content_path, published_at, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.type, row.title, row.description || '', row.body_html || '', row.is_private || 0, row.status || 'draft', row.content_path || null, row.published_at || null, row.created_at, row.updated_at, row.deleted_at || null)));
  rows('post_media').forEach((row) => statements.push(env.DB.prepare('INSERT INTO post_media (id, post_id, file_name, mime_type, size_bytes, sha256, drive_file_id, content_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.post_id, row.file_name, row.mime_type, row.size_bytes || 0, row.sha256 || null, row.drive_file_id || null, row.content_url || null, row.created_at)));
  rows('updates').forEach((row) => statements.push(env.DB.prepare('INSERT INTO updates (id, title, description, published_at, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)').bind(row.id, row.title, row.description || '', row.published_at, row.created_at, row.deleted_at || null)));
  rows('guestbook_comments').forEach((row) => statements.push(env.DB.prepare('INSERT INTO guestbook_comments (id, name, author_uid, content, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)').bind(row.id, row.name, row.author_uid || null, row.content, row.created_at, row.deleted_at || null)));
  rows('guestbook_replies').forEach((row) => statements.push(env.DB.prepare("INSERT INTO guestbook_replies (id, comment_id, content, created_at, deleted_at, author_type, author_name) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(row.id, row.comment_id, row.content, row.created_at, row.deleted_at || null, row.author_type || 'visitor', row.author_name || '')));
  rows('conversations').forEach((row) => statements.push(env.DB.prepare('INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)').bind(row.id, row.created_at, row.updated_at)));
  rows('messages').forEach((row) => statements.push(env.DB.prepare('INSERT INTO messages (id, conversation_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?)').bind(row.id, row.conversation_id, row.sender, row.content, row.created_at)));
  rows('admin_notifications').forEach((row) => statements.push(env.DB.prepare('INSERT INTO admin_notifications (id, type, title, body, entity_id, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.type, row.title, row.body, row.entity_id || null, row.created_at, row.read_at || null)));
  await env.DB.batch(statements);
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE backups SET restored_at = ? WHERE id = ?').bind(now, backupId).run();
  await recordNotification(env, 'restore', '백업 복원 완료', '선택한 백업으로 데이터를 복원했습니다.', backupId);
  return json({ ok: true, restoredAt: now });
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
  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
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

function requireCsrfHeader(request) {
  if (request.headers.get('X-Portfolio-Request') !== 'portfolio-app') {
    throw httpError('CSRF_BLOCKED', '허용되지 않은 요청입니다.', 403);
  }
}

async function requireUser(request, env) {
  const token = getBearer(request);
  if (!token) throw httpError('AUTH_REQUIRED', '로그인이 필요합니다.', 401);
  if (request.method !== 'GET') requireCsrfHeader(request);
  const claims = await verifyFirebaseToken(token, env);
  return { claims, role: await isAdmin(claims, env) ? 'admin' : 'member' };
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== 'admin' || !await isAdmin(user.claims, env)) throw httpError('FORBIDDEN', '관리자 권한이 없습니다.', 403);
  return user.claims;
}

async function optionalUser(request, env) {
  if (!getBearer(request)) return null;
  try { return await requireUser(request, env); } catch (error) {
    if (error.status === 401 || error.status ===403) return null;
    throw error;
  }
}

async function isAdmin(claims, env) {
  if (!env.DB || !claims?.sub) return false;
  return Boolean(await env.DB.prepare('SELECT uid FROM admin_roles WHERE uid = ?').bind(claims.sub).first());
}






function firebaseAuthErrorCode(payload) {
  const reason = String(payload?.error?.message || '');
  if (reason.includes('INVALID_API_KEY') || reason.includes('API_KEY_INVALID')) return 'AUTH_NOT_CONFIGURED';
  if (reason.includes('OPERATION_NOT_ALLOWED')) return 'AUTH_PROVIDER_DISABLED';
  if (reason.includes('EMAIL_NOT_FOUND') || reason.includes('INVALID_PASSWORD') || reason.includes('USER_DISABLED')) return 'AUTH_FAILED';
  return 'AUTH_SERVICE_ERROR';
}














function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function withVisitorCookie(response, visitorId) {
  const headers = new Headers(response.headers);
  if (!readCookieFromResponse(headers, 'portfolio_visitor_id')) {
    headers.append('Set-Cookie', 'portfolio_visitor_id=' + encodeURIComponent(visitorId) + '; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=None');
  }
  return new Response(response.body, { status: response.status, headers });
}

function readCookieFromResponse(headers, name) {
  return headers.get('Set-Cookie')?.split(';')[0]?.startsWith(name + '=') || false;
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
  if (!env.FIREBASE_WEB_API_KEY) {
    throw httpError('AUTH_NOT_CONFIGURED', 'Firebase 인증 설정이 필요합니다.', 503);
  }
  const response = await fetchWithTimeout(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(env.FIREBASE_WEB_API_KEY),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: String(token || '') }),
    },
  );
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const code = firebaseAuthErrorCode(failure);
    if (code === 'AUTH_NOT_CONFIGURED') {
      throw httpError('AUTH_NOT_CONFIGURED', 'Firebase 인증 서버 설정을 확인해주세요.', 503);
    }
    if (code === 'AUTH_PROVIDER_DISABLED') {
      throw httpError('AUTH_PROVIDER_DISABLED', 'Firebase Authentication 제공자 설정을 확인해주세요.', 503);
    }
    if (code === 'AUTH_FAILED') {
      throw httpError('AUTH_TOKEN_VERIFY_FAILED', '로그인 토큰을 확인할 수 없습니다. 다시 로그인해주세요.', 401);
    }
    throw httpError('AUTH_SERVICE_ERROR', 'Firebase 인증 서비스를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.', 502);
  }
  const payload = await response.json().catch(() => ({}));
  const user = payload.users?.[0];
  if (!user?.localId || user.disabled) {
    throw httpError('AUTH_TOKEN_VERIFY_FAILED', '로그인 토큰을 확인할 수 없습니다.', 401);
  }
  return {
    sub: user.localId,
    email: user.email || '',
    email_verified: user.emailVerified === true,
  };
}

function encodeText(value) {
  return encode(new TextEncoder().encode(String(value)));
}

function encode(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBytes(value) {
  const source = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = source + '='.repeat((4 - source.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function googleSubjectFromIdToken(idToken) {
  try {
    const payload = String(idToken || '').split('.')[1];
    const subject = JSON.parse(new TextDecoder().decode(decodeBytes(payload))).sub;
    if (!subject) throw new Error('missing_subject');
    return subject;
  } catch {
    throw httpError('GOOGLE_OAUTH_FAILED', 'Google 인증 토큰을 확인할 수 없습니다.', 502);
  }
}


function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, maxLength);
}


async function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw httpError('AUTH_UPSTREAM_TIMEOUT', '인증 서비스 응답 시간이 초과되었습니다.', 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function recordActivity(env, event, ctx) {
  const createdAt = new Date().toISOString();
  const metadata = JSON.stringify(event.metadata || {});
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO activity_events (event_id, actor_id, actor_type, action, entity_id, result, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      event.eventId,
      event.actorId,
      event.actorType,
      event.action,
      event.entityId || null,
      event.result || 'success',
      metadata,
      createdAt,
    ).run();
  } catch (error) {
    console.error('activity_ledger_failed', { code: error.code || 'D1_WRITE_FAILED' });
  }
  if (env.FIRESTORE_SERVICE_ACCOUNT_JSON) {
    const write = writeFirestoreActivity(env, { ...event, createdAt }).catch((error) => {
      console.error('activity_firestore_failed', { code: error.code || 'FIRESTORE_WRITE_FAILED' });
    });
    if (ctx?.waitUntil) ctx.waitUntil(write);
    else await write;
  }
}

async function writeFirestoreActivity(env, event) {
  const credentials = JSON.parse(env.FIRESTORE_SERVICE_ACCOUNT_JSON);
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
    throw new Error('FIRESTORE_CREDENTIALS_INVALID');
  }
  const accessToken = await getFirestoreAccessToken(credentials);
  const documentId = encodeURIComponent(event.actorId + '_' + event.eventId).slice(0, 500);
  const name = 'projects/' + credentials.project_id + '/databases/(default)/documents/activity_events/' + documentId;
  const fields = {
    actorId: { stringValue: event.actorId },
    actorType: { stringValue: event.actorType },
    action: { stringValue: event.action },
    entityId: { stringValue: event.entityId || '' },
    result: { stringValue: event.result || 'success' },
    metadata: { stringValue: JSON.stringify(event.metadata || {}) },
    createdAt: { timestampValue: event.createdAt },
  };
  const response = await fetch('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(credentials.project_id) + '/databases/(default)/documents:commit', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ update: { name, fields } }] }),
  });
  if (!response.ok) throw new Error('FIRESTORE_WRITE_FAILED');
}

async function getFirestoreAccessToken(credentials) {
  if (firestoreTokenCache.accessToken && firestoreTokenCache.expiresAt > Date.now() + 60_000) {
    return firestoreTokenCache.accessToken;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = encodeUrl(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = encodeUrl(JSON.stringify({
    iss: credentials.client_email,
    scope: FIRESTORE_SCOPE,
    aud: FIRESTORE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(header + '.' + claims),
  );
  const response = await fetch(FIRESTORE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: header + '.' + claims + '.' + encodeUrlBytes(new Uint8Array(signature)),
    }),
  });
  if (!response.ok) throw new Error('FIRESTORE_TOKEN_FAILED');
  const payload = await response.json();
  if (!payload.access_token) throw new Error('FIRESTORE_TOKEN_FAILED');
  firestoreTokenCache = { accessToken: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 };
  return payload.access_token;
}

function pemToBytes(value) {
  const base64 = String(value).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s+/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeUrl(value) {
  return encodeUrlBytes(new TextEncoder().encode(value));
}

function encodeUrlBytes(bytes) {
  return encode(bytes).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
}

async function runActivityBackup(env) {
  if (!env.DB) return;
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const result = await env.DB.prepare(
    'SELECT event_id, actor_id, actor_type, action, entity_id, result, metadata_json, created_at FROM activity_events WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC',
  ).bind(start.toISOString(), end.toISOString()).all();
  const payload = JSON.stringify({
    schemaVersion: 1,
    timezone: 'Asia/Seoul',
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    events: result.results || [],
  });
  const checksum = await sha256Text(payload);
  const id = 'activity_' + end.toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO activity_backup_runs (id, window_start, window_end, event_count, checksum, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, start.toISOString(), end.toISOString(), result.results?.length || 0, checksum, payload, end.toISOString()).run();
}

async function sha256Text(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encodeUrlBytes(new Uint8Array(digest));
}


function isSafeId(value) {
  return /^[A-Za-z0-9_-]{8,100}$/.test(value);
}

function getBearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function publicMessageForCode(code) {
  const messages = {
    INTERNAL_ERROR: '인증 서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    CERTS_UNAVAILABLE: 'Firebase 인증서를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
    SECRET_CONFIG_INVALID: '서버 보안 설정이 올바르지 않습니다. 운영 설정을 확인해주세요.',
    ADMIN_LOGIN_REQUIRED: '관리자 계정은 관리자 로그인 화면에서 인증해주세요.',
  };
  return messages[code] || '인증 서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

function httpError(code, publicMessage, status) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = publicMessage;
  error.status = status;
  return error;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function withCors(response, origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://hwahyo-o.github.io';
  const headers = new Headers(response.headers);
  if (origin === allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-Portfolio-Request');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  return new Response(response.body, { status: response.status, headers });
}
