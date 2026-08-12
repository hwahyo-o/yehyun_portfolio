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
    if (url.pathname === '/api/auth/login' && request.method === 'POST') { requireCsrfHeader(request); return loginAdmin(request, env); }
    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const claims = await requireAdmin(request, env);
      return json({ user: { uid: claims.sub, email: claims.email || null } });
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') { requireCsrfHeader(request); return logoutAdmin(request, env); }
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
    if (url.pathname === '/api/events' && request.method === 'POST') return recordPublicEvent(request, env);
    if (url.pathname === '/api/guestbook/' && request.method === 'PATCH') return json({ error: { code: 'NOT_FOUND', message: '방명록을 찾을 수 없습니다.' } }, 404);
    if (url.pathname.startsWith('/api/guestbook/') && url.pathname.endsWith('/replies') && request.method === 'POST') {
      return createGuestbookReply(request, env, url.pathname.split('/')[3]);
    }
    if (url.pathname.startsWith('/api/guestbook/') && ['PATCH', 'DELETE'].includes(request.method)) {
      const commentId = url.pathname.split('/').pop();
      return request.method === 'PATCH'
        ? updateGuestbook(request, env, commentId)
        : deleteGuestbook(request, env, commentId);
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
  const rootId = await getOrCreateDriveFolder(token, 'Portfolio-con');
  const dateId = await getOrCreateDriveFolder(token, kstDateFolder(iso), rootId);
  const postIdFolder = await getOrCreateDriveFolder(token, slugify(title) + '-' + postId.slice(0, 8), dateId);
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
  const result = await env.DB.prepare('SELECT id, name, content, created_at AS date FROM guestbook_comments WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10').all();
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
  await recordNotification(env, 'guestbook', 'Guestbook 새 댓글', name + '님이 Guestbook에 댓글을 남겼습니다.', id);
  return json({ item: { id, name, content, date: now } }, 201);
}

async function readGuestbookPassword(row, password) {
  if (!row || typeof password !== 'string' || password.length < 4 || password.length > 64) return false;
  const hash = await hashPassword(password, decodeBytes(row.password_salt));
  return safeEqual(hash, row.password_hash);
}

async function createGuestbookReply(request, env, commentId) {
  if (!isSafeId(commentId)) return json({ error: { code: 'INVALID_ID', message: '방명록 ID가 올바르지 않습니다.' } }, 400);
  const body = await request.json();
  const name = cleanText(body.name, 30);
  const content = cleanText(body.content, 1000);
  const parent = await env.DB.prepare('SELECT id FROM guestbook_comments WHERE id = ? AND deleted_at IS NULL').bind(commentId).first();
  if (!parent || !name || !content) return json({ error: { code: 'INVALID_INPUT', message: '대댓글 내용을 확인해주세요.' } }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO guestbook_replies (id, comment_id, content, author_type, author_name, created_at) VALUES (?, ?, ?, 'visitor', ?, ?)")
    .bind(id, commentId, content, name, now).run();
  await recordNotification(env, 'guestbook_reply', 'Guestbook 대댓글', name + '님이 관리자 댓글에 대댓글을 남겼습니다.', id);
  return json({ item: { id, commentId, name, content, date: now } }, 201);
}

async function updateGuestbook(request, env, commentId) {
  if (!isSafeId(commentId)) return json({ error: { code: 'INVALID_ID', message: '방명록 ID가 올바르지 않습니다.' } }, 400);
  const body = await request.json();
  const row = await env.DB.prepare('SELECT password_salt, password_hash FROM guestbook_comments WHERE id = ? AND deleted_at IS NULL').bind(commentId).first();
  if (!await readGuestbookPassword(row, String(body.password || ''))) return json({ error: { code: 'PASSWORD_MISMATCH', message: '비밀번호가 일치하지 않습니다.' } }, 403);
  const content = cleanText(body.content, 1000);
  if (!content) return json({ error: { code: 'INVALID_INPUT', message: '내용을 입력해주세요.' } }, 400);
  await env.DB.prepare('UPDATE guestbook_comments SET content = ? WHERE id = ?').bind(content, commentId).run();
  return json({ ok: true });
}

async function deleteGuestbook(request, env, commentId) {
  if (!isSafeId(commentId)) return json({ error: { code: 'INVALID_ID', message: '방명록 ID가 올바르지 않습니다.' } }, 400);
  const body = await request.json();
  const row = await env.DB.prepare('SELECT password_salt, password_hash FROM guestbook_comments WHERE id = ? AND deleted_at IS NULL').bind(commentId).first();
  if (!await readGuestbookPassword(row, String(body.password || ''))) return json({ error: { code: 'PASSWORD_MISMATCH', message: '비밀번호가 일치하지 않습니다.' } }, 403);
  await env.DB.prepare('UPDATE guestbook_comments SET deleted_at = ? WHERE id = ?').bind(new Date().toISOString(), commentId).run();
  return json({ ok: true });
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
  await recordNotification(env, 'dm', 'Direct Message 새 문의', '방문자가 새 메시지를 보냈습니다.', conversationId);
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
  const googleSubject = token.id_token ? JSON.parse(decode(token.id_token.split('.')[1])).sub || null : null;
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO google_drive_connections (id, uid, google_subject, refresh_token_ciphertext, refresh_token_iv, created_at, updated_at)
    VALUES ('primary', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET uid = excluded.uid, google_subject = excluded.google_subject, refresh_token_ciphertext = excluded.refresh_token_ciphertext, refresh_token_iv = excluded.refresh_token_iv, updated_at = excluded.updated_at`)
    .bind(stateRow.uid, googleSubject, encrypted.ciphertext, encrypted.iv, now, now).run();
  return oauthRedirect(env, 'admin-drive-connected');
}

function oauthRedirect(env, status) {
  const origin = env.FRONTEND_URL || 'https://hwahyo-o.github.io/yehyun_portfolio';
  return new Response(null, { status: 302, headers: { Location: `${origin}/#${status}` } });
}

function encryptionKeyBytes(encodedKey) {
  try {
    const bytes = decodeBytes(String(encodedKey || ''));
    if (bytes.length !== 32) throw new Error('invalid key length');
    return bytes;
  } catch {
    throw httpError('SECRET_CONFIG_INVALID', '서버 보안 설정이 올바르지 않습니다.', 503);
  }
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
  return json({ connected: Boolean(connection), updatedAt: connection?.updated_at || null });
}

async function disconnectDrive(env) {
  await env.DB.prepare('DELETE FROM google_drive_connections WHERE id = ?').bind('primary').run();
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

async function recordPublicEvent(request, env) {
  const body = await request.json();
  const type = ['share', 'reaction'].includes(body.type) ? body.type : '';
  if (!type) return json({ error: { code: 'INVALID_INPUT', message: '이벤트 종류가 올바르지 않습니다.' } }, 400);
  await recordNotification(
    env,
    type,
    type === 'share' ? '게시물 공유 알림' : '게시물 반응 알림',
    type === 'share' ? '방문자가 게시물을 공유했습니다.' : '방문자가 게시물에 반응을 남겼습니다.',
    cleanText(body.postId, 100),
  );
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
  rows('guestbook_comments').forEach((row) => statements.push(env.DB.prepare('INSERT INTO guestbook_comments (id, name, password_salt, password_hash, content, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(row.id, row.name, row.password_salt, row.password_hash, row.content, row.created_at, row.deleted_at || null)));
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

function requireCsrfHeader(request) {
  if (request.headers.get('X-Portfolio-Request') !== 'portfolio-app') {
    throw httpError('CSRF_BLOCKED', '허용되지 않은 요청입니다.', 403);
  }
}

async function requireAdmin(request, env) {
  const sessionToken = readCookie(request, 'portfolio_admin_session');
  if (sessionToken) {
    requireCsrfHeader(request);
    const sessionId = await hashSessionToken(sessionToken);
    const row = await env.DB.prepare('SELECT id, uid, email, refresh_token_ciphertext, refresh_token_iv FROM admin_sessions WHERE id = ?').bind(sessionId).first();
    if (!row) throw httpError('AUTH_REQUIRED', '관리자 로그인이 필요합니다.', 401);
    try {
      const refreshToken = await decryptSecret(row.refresh_token_ciphertext, row.refresh_token_iv, env.SESSION_ENCRYPTION_KEY);
      const refreshed = await refreshFirebaseToken(refreshToken, env);
      const claims = await verifyFirebaseToken(refreshed.idToken, env);
      if (claims.sub !== row.uid || !await isAdmin(claims.sub, env)) throw httpError('FORBIDDEN', '관리자 권한이 없습니다.', 403);
      if (refreshed.refreshToken && refreshed.refreshToken !== refreshToken) {
        const encrypted = await encryptSecret(refreshed.refreshToken, env.SESSION_ENCRYPTION_KEY);
        await env.DB.prepare('UPDATE admin_sessions SET refresh_token_ciphertext = ?, refresh_token_iv = ?, updated_at = ? WHERE id = ?')
          .bind(encrypted.ciphertext, encrypted.iv, new Date().toISOString(), sessionId).run();
      } else {
        await env.DB.prepare('UPDATE admin_sessions SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), sessionId).run();
      }
      return claims;
    } catch (error) {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run();
      if (error.code === 'FORBIDDEN') throw error;
      throw httpError('AUTH_REQUIRED', '관리자 로그인이 만료되었습니다.', 401);
    }
  }
  const token = getBearer(request);
  if (!token) throw httpError('AUTH_REQUIRED', '관리자 로그인이 필요합니다.', 401);
  const claims = await verifyFirebaseToken(token, env);
  if (!await isAdmin(claims.sub, env)) throw httpError('FORBIDDEN', '관리자 권한이 없습니다.', 403);
  return claims;
}

async function isAdmin(uid, env) {
  if (env.ADMIN_UIDS) return env.ADMIN_UIDS.split(',').map((value) => value.trim()).includes(uid);
  const row = await env.DB.prepare('SELECT 1 FROM admin_roles WHERE uid = ?').bind(uid).first();
  return Boolean(row);
}

async function loginAdmin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || password.length < 1 || password.length > 256) {
    throw httpError('AUTH_FAILED', '이메일 또는 비밀번호를 확인해주세요.', 401);
  }
  if (!env.FIREBASE_WEB_API_KEY || !env.SESSION_ENCRYPTION_KEY) {
    throw httpError('AUTH_NOT_CONFIGURED', '관리자 로그인을 사용할 수 없습니다.', 503);
  }
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(env.FIREBASE_WEB_API_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw httpError('AUTH_FAILED', '이메일 또는 비밀번호를 확인해주세요.', 401);
  const payload = await response.json();
  const claims = await verifyFirebaseToken(payload.idToken, env);
  if (!await isAdmin(claims.sub, env)) throw httpError('FORBIDDEN', '관리자 권한이 없습니다.', 403);
  const rawSession = crypto.randomUUID() + crypto.randomUUID();
  const encrypted = await encryptSecret(payload.refreshToken, env.SESSION_ENCRYPTION_KEY);
  await env.DB.prepare('INSERT INTO admin_sessions (id, uid, email, refresh_token_ciphertext, refresh_token_iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(await hashSessionToken(rawSession), claims.sub, email, encrypted.ciphertext, encrypted.iv, new Date().toISOString(), new Date().toISOString()).run();
  return withCookie(json({ user: { uid: claims.sub, email } }), rawSession);
}

async function logoutAdmin(request, env) {
  const rawSession = readCookie(request, 'portfolio_admin_session');
  if (rawSession) await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(await hashSessionToken(rawSession)).run();
  return clearCookie(json({ ok: true }));
}

async function refreshFirebaseToken(refreshToken, env) {
  const response = await fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(env.FIREBASE_WEB_API_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!response.ok) throw httpError('AUTH_REQUIRED', '관리자 로그인이 만료되었습니다.', 401);
  const payload = await response.json();
  return { idToken: payload.id_token, refreshToken: payload.refresh_token || refreshToken };
}

async function hashSessionToken(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encode(new Uint8Array(digest));
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function withCookie(response, value) {
  const headers = new Headers(response.headers);
  headers.set('Set-Cookie', 'portfolio_admin_session=' + encodeURIComponent(value) + '; Max-Age=315360000; Path=/; HttpOnly; Secure; SameSite=None');
  return new Response(response.body, { status: response.status, headers });
}

function clearCookie(response) {
  const headers = new Headers(response.headers);
  headers.set('Set-Cookie', 'portfolio_admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None');
  return new Response(response.body, { status: response.status, headers });
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

function safeEqual(left, right) {
  const a = decodeBytes(left);
  const b = decodeBytes(right);
  if (a.length !== b.length) return false;
  let result = 0;
  a.forEach((value, index) => { result |= value ^ b[index]; });
  return result === 0;
}

function encodeText(value) {
  return encode(new TextEncoder().encode(String(value)));
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
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, X-Portfolio-Request');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  return new Response(response.body, { status: response.status, headers });
}
