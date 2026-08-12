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
    themeToggle.innerHTML = nextTheme === 'dark'
      ? '<i class="bi bi-sun" aria-hidden="true"></i>'
      : '<i class="bi bi-moon-stars" aria-hidden="true"></i>';
    themeToggle.setAttribute('aria-label', nextTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function initTheme() {
  const saved = window.localStorage.getItem('portfolio-theme');
  applyTheme(saved || 'light');
}

function apiRequest(path, options = {}) {
  if (!apiBase) return Promise.reject(new Error('API is not configured'));
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || '요청을 처리하지 못했습니다.');
    return payload;
  });
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
    entry.append(createText('time', item.date || item.createdAt || ''));
    entry.append(createText('strong', item.name || 'Anonymous'));
    entry.append(createText('p', item.content || ''));
    guestbookList.append(entry);
  });
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
  if (action === 'admin-login') {
    window.alert('관리자 로그인은 서버 연결 후 제공됩니다.');
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
loadCommunity();
startGalleryLoop();

const loadingInterval = window.setInterval(shuffleLoadingFont, 300);
window.setTimeout(() => {
  window.clearInterval(loadingInterval);
  completeLoading();
}, 3000);
