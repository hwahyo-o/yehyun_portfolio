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
};

const shell = document.querySelector('#site-shell');
const loadingLayer = document.querySelector('#loading-layer');
const loadingWords = document.querySelectorAll('.loading-word');
const nameDisplay = document.querySelector('#name-display');
const homePage = document.querySelector('#home-page');
const categoryPage = document.querySelector('#category-page');
const categoryName = document.querySelector('#category-name');

function randomFont(previous) {
  const available = fonts.filter((font) => font !== previous);
  return available[Math.floor(Math.random() * available.length)];
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

  if (category) categoryName.textContent = category;
}

function navigate(route) {
  window.location.hash = route === 'home' ? '' : route;
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

document.addEventListener('click', (event) => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    navigate(routeTarget.dataset.route);
    return;
  }

  if (event.target.closest('[data-action="top"]')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

window.addEventListener('hashchange', updatePage);

updatePage();
bindNameShuffle();

const loadingInterval = window.setInterval(shuffleLoadingFont, 300);
window.setTimeout(() => {
  window.clearInterval(loadingInterval);
  completeLoading();
}, 3000);
