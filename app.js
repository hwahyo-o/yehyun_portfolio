const fonts = [
  'Wanted Sans',
  'Mona',
  'DearFromsol',
  'Gunhamimalmunteuyeot',
  'Ridibatang',
  'BonmyeongjoSourceHanSerif',
  'Arial',
];

const categories = ['UX/UI', 'Graphic', 'Video'];
const state = {
  loadingFont: fonts[0],
  nameFont: fonts[0],
  lastPointer: null,
  lastShuffleAt: 0,
  galleryIndex: 0,
  chatTimer: null,
  isAdmin: false,
};

const shell = document.querySelector('#site-shell');
const loadingLayer = document.querySelector('#loading-layer');
const loadingWords = document.querySelectorAll('.loading-word');
const nameDisplay = document.querySelector('#name-display');
const homePage = document.querySelector('#home-page');
const categoryPage = document.querySelector('#category-page');
const categoryName = document.querySelector('#category-name');
const categoryDetailName = document.querySelector('#category-detail-name');
const galleryTrack = document.querySelector('#gallery-track');
const gallerySlides = document.querySelectorAll('[data-gallery-slide]');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const apiBase = String(window.PORTFOLIO_CONFIG?.apiBase || '').replace(/\/$/, '');
const themeToggle = document.querySelector('#theme-toggle');
const updateList = document.querySelector('#update-list');
const updateStatus = document.querySelector('#update-status');
const guestbookList = document.querySelector('#guestbook-list');
const guestbookStatus = document.querySelector('#guestbook-status');
const guestbookForm = document.querySelector('#guestbook-form');
const chatPanel = document.querySelector('#chat-panel');
const chatMessages = document.querySelector('#chat-messages');
const chatForm = document.querySelector('#chat-form');
const adminLoginButton = document.querySelector('#admin-login-button');
const adminSessionTools = document.querySelector('#admin-session-tools');
const adminLoginModal = document.querySelector('#admin-login-modal');
const adminLoginForm = document.querySelector('#admin-login-form');
const adminLoginStatus = document.querySelector('#admin-login-status');
const settingsModal = document.querySelector('#settings-modal');
const notificationCenter = document.querySelector('#notification-center');
const notificationList = document.querySelector('#notification-list');
const notificationCount = document.querySelector('#notification-count');
const driveConnectionStatus = document.querySelector('#drive-connection-status');
const backupList = document.querySelector('#backup-list');
const backupListStatus = document.querySelector('#backup-list-status');
const backupStatus = document.querySelector('#backup-status');

function randomFont(previous) {
  const available = fonts.filter((font) => font !== previous);
  return available[Math.floor(Math.random() * available.length)];
}

function resetScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function readCategory() {
  const match = window.location.hash.slice(1).match(/^category\/([^/]+)/);
  if (!match) return null;

  const category = decodeURIComponent(match[1]);
  return categories.includes(category) ? category : null;
}

function updatePage() {
  const category = readCategory();
  const isCategory = Boolean(category);

  homePage.hidden = isCategory;
  categoryPage.hidden = !isCategory;

  if (category) {
    categoryName.textContent = category;
    categoryDetailName.textContent = category;
  }

  resetScroll();
}

function navigate(route) {
  const nextHash = route === 'home' ? '' : route;
  if (window.location.hash.slice(1) === nextHash) {
    resetScroll();
    return;
  }

  window.location.hash = nextHash;
}

function shuffleLoadingFont() {
  state.loadingFont = randomFont(state.loadingFont);
  loadingWords.forEach((word) => {
    word.style.fontFamily = state.loadingFont;
  });
}

function completeLoading() {
  shell.classList.remove('is-loading');
  shell.classList.add('is-ready');
  loadingLayer.classList.add('is-leaving');
  window.setTimeout(() => {
    loadingLayer.hidden = true;
  }, 450);
}

function shuffleNameFont() {
  const now = performance.now();
  if (now - state.lastShuffleAt < 400) return;

  state.lastShuffleAt = now;
  window.cancelAnimationFrame(state.nameFrame);
  state.nameFrame = window.requestAnimationFrame(() => {
    state.nameFont = randomFont(state.nameFont);
    nameDisplay.style.fontFamily = state.nameFont;
  });
}

function bindNameShuffle() {
  nameDisplay.addEventListener('pointerenter', () => {
    state.lastPointer = null;
    shuffleNameFont();
  });

  nameDisplay.addEventListener('pointermove', (event) => {
    const point = { x: event.clientX, y: event.clientY };
    const previous = state.lastPointer;
    state.lastPointer = point;

    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) >= 32) {
      shuffleNameFont();
    }
  });

  nameDisplay.addEventListener('focus', shuffleNameFont);
}

function showGallerySlide(index, instant = false) {
  if (!galleryTrack) return;

  galleryTrack.style.transition = instant ? 'none' : '';
  galleryTrack.style.transform = `translate3d(-${index * 100}%, 0, 0)`;

  if (instant) {
    window.requestAnimationFrame(() => {
      galleryTrack.style.transition = '';
    });
  }
}

function advanceGallery() {
  const loopEnd = gallerySlides.length - 1;
  if (loopEnd < 1) return;

  if (state.galleryIndex === loopEnd - 1) {
    state.galleryIndex = loopEnd;
    showGallerySlide(state.galleryIndex);
    window.setTimeout(() => {
      state.galleryIndex = 0;
      showGallerySlide(0, true);
    }, 380);
    return;
  }

  state.galleryIndex += 1;
  showGallerySlide(state.galleryIndex);
}

function startGalleryLoop() {
  if (!galleryTrack || gallerySlides.length < 2 || reducedMotionQuery.matches) return;
  window.setInterval(advanceGallery, 800);
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = nextTheme;
  window.localStorage.setItem('portfolio-theme', nextTheme);
  if (themeToggle) {
    const icon = document.createElement('i');
    icon.className = nextTheme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    icon.setAttribute('aria-hidden', 'true');
    themeToggle.replaceChildren(icon);
    themeToggle.setAttribute('aria-label', nextTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function initTheme() {
  const saved = window.localStorage.getItem('portfolio-theme');
  applyTheme(saved || 'light');
}

async function authHeaders() {
  return { 'Content-Type': 'application/json', 'X-Portfolio-Request': 'portfolio-app' };
}

async function apiRequest(path, options = {}) {
  if (!apiBase) throw new Error('API가 설정되지 않았습니다.');
  const response = await fetch(apiBase + path, {
    ...options,
    credentials: 'include',
    headers: { ...(await authHeaders()), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || '요청을 처리하지 못했습니다.');
  return payload;
}

function createText(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderUpdates(items = []) {
  updateList.replaceChildren();
  if (!items.length) {
    updateList.append(createText('li', apiBase ? '등록된 업데이트가 없습니다.' : '서버 연결 후 업데이트가 표시됩니다.', 'empty-state'));
    return;
  }
  items.forEach((item) => {
    const entry = document.createElement('li');
    entry.append(createText('time', item.date || item.createdAt || ''));
    entry.append(createText('strong', item.title || 'Update'));
    entry.append(createText('p', item.description || ''));
    updateList.append(entry);
  });
}

function renderGuestbook(items = []) {
  guestbookList.replaceChildren();
  if (!items.length) {
    guestbookList.append(createText('li', apiBase ? '등록된 방명록이 없습니다.' : '서버 연결 후 방명록이 표시됩니다.', 'empty-state'));
    return;
  }
  items.forEach((item) => {
    const entry = document.createElement('li');
    entry.className = 'guestbook-item';
    const actions = document.createElement('div');
    actions.className = 'guestbook-actions';
    ['edit', 'delete'].forEach((action) => {
      const button = createText('button', action === 'edit' ? '수정' : '삭제', 'btn btn-sm btn-outline-secondary');
      button.type = 'button';
      button.dataset.guestbookAction = action;
      button.dataset.guestbookId = item.id;
      actions.append(button);
    });
    entry.append(
      createText('time', item.date || item.createdAt || ''),
      createText('strong', item.name || 'Anonymous'),
      createText('p', item.content || ''),
    );
    if (Array.isArray(item.replies) && item.replies.length) {
      const replies = document.createElement('ol');
      replies.className = 'guestbook-replies';
      item.replies.forEach((reply) => {
        const replyItem = document.createElement('li');
        replyItem.append(
          createText('strong', reply.author_name || 'Anonymous'),
          createText('p', reply.content || ''),
          createText('time', reply.date || ''),
        );
        replies.append(replyItem);
      });
      entry.append(replies);
    }
    entry.append(actions);
    guestbookList.append(entry);
  });
}

async function editGuestbookComment(id) {
  const password = window.prompt('댓글 작성 시 입력한 비밀번호를 입력해주세요.');
  if (password === null) return;
  const content = window.prompt('수정할 내용을 입력해주세요.');
  if (content === null || !content.trim()) return;
  await apiRequest('/api/guestbook/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ password, content }),
  });
  await loadCommunity();
}

async function deleteGuestbookComment(id) {
  const password = window.prompt('댓글 삭제를 위해 비밀번호를 입력해주세요.');
  if (password === null) return;
  if (!window.confirm('이 댓글을 삭제할까요?')) return;
  await apiRequest('/api/guestbook/' + encodeURIComponent(id), {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
  await loadCommunity();
}

async function loadCommunity() {
  if (!apiBase) {
    updateStatus.textContent = 'Offline';
    guestbookStatus.textContent = 'Offline';
    renderUpdates();
    renderGuestbook();
    return;
  }
  try {
    const [updates, guestbook] = await Promise.all([
      apiRequest('/api/updates'),
      apiRequest('/api/guestbook'),
    ]);
    renderUpdates(updates.items || updates);
    renderGuestbook(guestbook.items || guestbook);
    updateStatus.textContent = 'Live';
    guestbookStatus.textContent = 'Live';
  } catch (error) {
    updateStatus.textContent = 'Unavailable';
    guestbookStatus.textContent = 'Unavailable';
    renderUpdates();
    renderGuestbook();
  }
}

function renderChat(messages = []) {
  chatMessages.replaceChildren();
  if (!messages.length) {
    chatMessages.append(createText('p', '안녕하세요! 문의사항을 남겨주세요.', 'empty-state'));
    return;
  }
  messages.forEach((message) => {
    const item = createText('p', message.content || '', `chat-message ${message.sender === 'admin' ? 'is-admin' : 'is-me'}`);
    chatMessages.append(item);
  });
}

async function loadChat() {
  const conversationId = window.sessionStorage.getItem('portfolio-conversation-id');
  if (!apiBase || !conversationId) return;
  try {
    const payload = await apiRequest(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
    renderChat(payload.items || payload);
  } catch {
    // The chat remains usable when the optional API is temporarily unavailable.
  }
}

function startChatPolling() {
  window.clearInterval(state.chatTimer);
  if (!apiBase) return;
  state.chatTimer = window.setInterval(loadChat, 7000);
}

function openModal(modal) {
  if (modal) modal.hidden = false;
}

function closeModal(modal) {
  if (modal) modal.hidden = true;
}

function setAdminUi(isAdmin) {
  state.isAdmin = isAdmin;
  adminLoginButton.hidden = isAdmin;
  adminSessionTools.hidden = !isAdmin;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value)) : '';
}

function renderNotifications(items = []) {
  notificationList.replaceChildren();
  const unread = items.filter((item) => !item.read_at).length;
  notificationCount.textContent = String(unread);
  notificationCount.hidden = unread === 0;
  if (!items.length) {
    notificationList.append(createText('li', '새 알림이 없습니다.', 'empty-state'));
    return;
  }
  items.forEach((item) => {
    const entry = document.createElement('li');
    entry.className = 'notification-item';
    entry.append(createText('strong', item.title || '알림'));
    entry.append(createText('p', item.body || ''));
    entry.append(createText('small', formatDate(item.created_at)));
    notificationList.append(entry);
  });
}

async function loadNotifications() {
  if (!state.isAdmin) return;
  const payload = await apiRequest('/api/admin/notifications');
  renderNotifications(payload.items || []);
}

async function loadDriveStatus() {
  if (!state.isAdmin) return;
  const payload = await apiRequest('/api/admin/drive/status');
  driveConnectionStatus.textContent = payload.connected
    ? '연결됨' : '연결되지 않음';
}

function renderBackups(items = []) {
  backupList.replaceChildren();
  backupListStatus.textContent = items.length + '개';
  if (!items.length) {
    backupList.append(createText('li', '백업 파일이 없습니다.', 'empty-state'));
    return;
  }
  items.forEach((item) => {
    const entry = document.createElement('li');
    entry.className = 'backup-item';
    const info = document.createElement('div');
    info.className = 'backup-item-info';
    info.append(createText('strong', item.file_name || 'backup.json'));
    info.append(createText('small', (item.mode === 'auto' ? '자동' : '수동') + ' · ' + formatDate(item.created_at)));
    const actions = document.createElement('div');
    actions.className = 'backup-item-actions';
    [['download', '다운로드'], ['restore', '복원']].forEach(([action, label]) => {
      const button = createText('button', label, 'btn btn-outline-secondary');
      button.type = 'button';
      button.dataset.backupAction = action;
      button.dataset.backupId = item.id;
      actions.append(button);
    });
    entry.append(info, actions);
    backupList.append(entry);
  });
}

async function loadBackups() {
  if (!state.isAdmin) return;
  const payload = await apiRequest('/api/admin/backups');
  renderBackups(payload.items || []);
}

async function loadAdminPanel() {
  await Promise.all([loadNotifications(), loadDriveStatus(), loadBackups()]);
}

async function createBackup(mode) {
  backupStatus.textContent = mode === 'auto' ? '자동 백업 중…' : '수동 백업 중…';
  try {
    await apiRequest('/api/admin/backups', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    backupStatus.textContent = '백업이 완료되었습니다.';
    await Promise.all([loadBackups(), loadNotifications()]);
    return true;
  } catch (error) {
    backupStatus.textContent = error.message;
    return false;
  }
}

function kstParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

async function checkAutoBackup() {
  if (!state.isAdmin || document.visibilityState !== 'visible') return;
  const parts = kstParts();
  const hour = Number(parts.hour) % 24;
  if (![0, 8, 16].includes(hour) || Number(parts.minute) > 1) return;
  const slot = parts.year + '-' + parts.month + '-' + parts.day + '-' + String(hour).padStart(2, '0');
  if (state.autoBackupSlot === slot || sessionStorage.getItem('portfolio-auto-backup-slot') === slot) return;
  if (await createBackup('auto')) {
    state.autoBackupSlot = slot;
    sessionStorage.setItem('portfolio-auto-backup-slot', slot);
  }
}

function startAdminScheduler() {
  clearInterval(state.adminTimer);
  clearInterval(state.notificationTimer);
  if (!state.isAdmin) return;
  checkAutoBackup();
  state.adminTimer = setInterval(checkAutoBackup, 30000);
  state.notificationTimer = setInterval(() => loadNotifications().catch(() => {}), 30000);
}

async function verifyAdminSession() {
  try {
    await apiRequest('/api/auth/session');
    setAdminUi(true);
    closeModal(adminLoginModal);
    startAdminScheduler();
    await loadAdminPanel();
  } catch {
    setAdminUi(false);
    clearInterval(state.adminTimer);
    clearInterval(state.notificationTimer);
  }
}

async function setupAuthSession() {
  if (!apiBase) return;
  try {
    await verifyAdminSession();
  } catch {
    setAdminUi(false);
  }
}

async function downloadBackup(id) {
  const response = await fetch(apiBase + '/api/admin/backups/' + encodeURIComponent(id) + '/download', {
    credentials: 'include',
    headers: { 'X-Portfolio-Request': 'portfolio-app' },
  });
  if (!response.ok) throw new Error('백업 다운로드에 실패했습니다.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'portfolio-backup.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function bindAdminActions() {
  adminLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    adminLoginStatus.textContent = '로그인 중…';
    const data = new FormData(adminLoginForm);
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(data.get('email') || ''),
          password: String(data.get('password') || ''),
        }),
      });
      adminLoginForm.reset();
      await verifyAdminSession();
    } catch {
      adminLoginStatus.textContent = '이메일 또는 비밀번호를 확인해주세요.';
    }
  });
  document.addEventListener('visibilitychange', checkAutoBackup);
}

function bindCommunityActions() {
  guestbookForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!apiBase) return;
    const data = new FormData(guestbookForm);
    try {
      await apiRequest('/api/guestbook', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      guestbookForm.reset();
      await loadCommunity();
    } catch (error) {
      window.alert(error.message);
    }
  });

  chatForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!apiBase) return;
    const data = new FormData(chatForm);
    const message = String(data.get('message') || '').trim();
    if (!message) return;
    let conversationId = window.sessionStorage.getItem('portfolio-conversation-id');
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      window.sessionStorage.setItem('portfolio-conversation-id', conversationId);
    }
    try {
      await apiRequest(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      chatForm.reset();
      await loadChat();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

document.addEventListener('click', (event) => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    navigate(routeTarget.dataset.route);
    return;
  }

  const scrollTarget = event.target.closest('[data-scroll-target]');
  if (scrollTarget) {
    document.querySelector(`#${scrollTarget.dataset.scrollTarget}`)?.scrollIntoView({ behavior: reducedMotionQuery.matches ? 'auto' : 'smooth' });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'top') resetScroll();
  if (action === 'theme') applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  if (action === 'open-chat') {
    chatPanel.hidden = false;
    loadChat();
    startChatPolling();
  }
  if (action === 'close-chat') {
    chatPanel.hidden = true;
    window.clearInterval(state.chatTimer);
  }
  if (action === 'admin-login') openModal(adminLoginModal);
  if (action === 'close-login') closeModal(adminLoginModal);
  if (action === 'settings') {
    openModal(settingsModal);
    loadAdminPanel().catch((error) => { backupStatus.textContent = error.message; });
  }
  if (action === 'close-settings') closeModal(settingsModal);
  if (action === 'notifications') {
    notificationCenter.hidden = !notificationCenter.hidden;
    if (!notificationCenter.hidden) {
      loadNotifications()
        .then(() => apiRequest('/api/admin/notifications/read', { method: 'POST' }))
        .then(loadNotifications)
        .catch(() => {});
    }
  }
  if (action === 'close-notifications') notificationCenter.hidden = true;
  if (action === 'admin-logout') {
    apiRequest('/api/auth/logout', { method: 'POST' })
      .finally(() => {
        setAdminUi(false);
        clearInterval(state.adminTimer);
        clearInterval(state.notificationTimer);
      });
  }
  if (action === 'backup-now') createBackup('manual');
  if (action === 'drive-connect') {
    apiRequest('/api/admin/drive/start', { headers: { Accept: 'application/json' } })
      .then((payload) => { window.location.href = payload.authorizationUrl; })
      .catch((error) => { driveConnectionStatus.textContent = error.message; });
  }
  if (action === 'drive-disconnect') {
    if (window.confirm('Google Drive 연결을 끊을까요? 백업 파일은 삭제되지 않습니다.')) {
      apiRequest('/api/admin/drive/disconnect', { method: 'POST' })
        .then(loadDriveStatus)
        .catch((error) => { driveConnectionStatus.textContent = error.message; });
    }
  }
  const guestbookButton = event.target.closest('[data-guestbook-action]');
  if (guestbookButton) {
    const actionName = guestbookButton.dataset.guestbookAction;
    const handler = actionName === 'edit' ? editGuestbookComment : deleteGuestbookComment;
    handler(guestbookButton.dataset.guestbookId).catch((error) => window.alert(error.message));
    return;
  }

  const backupButton = event.target.closest('[data-backup-action]');
  if (backupButton) {
    const id = encodeURIComponent(backupButton.dataset.backupId);
    if (backupButton.dataset.backupAction === 'download') {
      downloadBackup(id).catch((error) => { backupStatus.textContent = error.message; });
    }
    if (backupButton.dataset.backupAction === 'restore' && window.confirm('선택한 백업으로 공유 데이터를 복원할까요? 현재 데이터가 교체됩니다.')) {
      apiRequest('/api/admin/backups/' + id + '/restore', { method: 'POST' })
        .then(loadCommunity)
        .catch((error) => { backupStatus.textContent = error.message; });
    }
  }
});

window.history.scrollRestoration = 'manual';
window.addEventListener('hashchange', updatePage);
window.addEventListener('pageshow', resetScroll);
window.addEventListener('load', resetScroll);

updatePage();
initTheme();
bindNameShuffle();
bindCommunityActions();
bindAdminActions();
loadCommunity();
startGalleryLoop();
setupAuthSession();

const loadingInterval = window.setInterval(shuffleLoadingFont, 300);
window.setTimeout(() => {
  window.clearInterval(loadingInterval);
  completeLoading();
}, 3000);
