import { categories, getProjects } from './projects.js';

const fonts = [
  'Wanted Sans',
  'Mona',
  'DearFromsol',
  'Gunhamimalmunteuyeot',
  'Ridibatang',
  'BonmyeongjoSourceHanSerif',
  'Arial',
];

const state = {
  route: readRoute(),
  loading: true,
  loadingLeaving: false,
  loadingFont: fonts[0],
  nameFont: fonts[0],
  categoryIndex: 0,
  lastPointer: null,
  lastShuffleAt: 0,
};

let loadingInterval;
let nameShuffleFrame;

function randomFont(previous) {
  const available = fonts.filter((font) => font !== previous);
  return available[Math.floor(Math.random() * available.length)];
}

function readRoute() {
  return window.location.hash.slice(1) || 'home';
}

function encodeRoute(category, slug = '') {
  const path = 'category/' + encodeURIComponent(category);
  return slug ? path + '/' + encodeURIComponent(slug) : path;
}

function navigate(route) {
  window.location.hash = route === 'home' ? '' : route;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function renderGnb() {
  return \`
    <header class="gnb">
      <button class="logo-button" data-route="home" aria-label="YeHyun home">
        <img src="./public/yehyun_logo.png" alt="YeHyun">
      </button>
      <nav aria-label="Portfolio categories">
        \${categories.map((category) => \`
          <button data-route="\${encodeRoute(category)}">\${escapeHtml(category)}</button>
        \`).join('')}
      </nav>
    </header>
  \`;
}

function renderLoading() {
  if (!state.loading) return '';

  return \`
    <div class="loading-layer\${state.loadingLeaving ? ' is-leaving' : ''}">
      <section class="loading-screen" aria-label="Portfolio loading">
        <div class="loading-lockup">
          <div class="loading-title" aria-label="Portfolio 2026">
            <span class="loading-word loading-highlight" style="font-family: '\${state.loadingFont}'">Portfolio</span>
            <span class="loading-word" style="font-family: '\${state.loadingFont}'">2026</span>
          </div>
          <div class="loading-meta">
            <span>Yang Ye Hyun</span>
            <span class="loading-rule" aria-hidden="true"></span>
            <span>visual designer / portfolio</span>
          </div>
        </div>
      </section>
    </div>
  \`;
}

function renderAbout() {
  return \`
    <section class="about-section" id="about">
      <p class="section-label">About Me</p>
      <div class="about-heading-row">
        <button
          class="name-display"
          id="name-display"
          data-name-shuffle
          style="font-family: '\${state.nameFont}'"
          aria-label="Yang Ye Hyun, move the pointer or focus to shuffle the font"
        >
          Yang Ye Hyun
        </button>
        <dl class="contact-list">
          <div><dt>Mail</dt><dd>ajas03974@gmail.com</dd></div>
          <div><dt>Phone</dt><dd>010-6797-0462</dd></div>
        </dl>
        <div class="tool-strip" aria-label="Tools">
          \${['Ps', 'Pr', 'Ae', 'Ai', 'Xd', 'VS', 'HTML', 'CSS', 'JS', 'Figma']
            .map((tool) => \`<span class="tool-chip">\${tool}</span>\`).join('')}
        </div>
      </div>
      <div class="about-divider"></div>
      <div class="resume-grid">
        <div>
          <p><strong>2015년 입학</strong> 영주 선영여자고등학교 / 미술중점반(디자인)</p>
          <p class="resume-subline">2015년 교내 미술 전시 팜플렛 제작활동</p>
          <p><strong>2018년 졸업</strong> 영주선영여자고등학교 졸업 / 미술중점반(디자인)</p>
        </div>
        <div>
          <p><strong>GTQ - 포토샵 1급</strong> 2024년 5월 / 한국생산성본부</p>
          <p><strong>GTQ - 일러스트 1급</strong> 2024년 5월 / 한국생산성본부</p>
          <p><strong>웹디자인기능사</strong> 2024년 9월 / 한국산업인력공단</p>
          <p><strong>컴퓨터그래픽스운용기능사</strong> 2024년 9월 / 한국산업인력공단</p>
        </div>
      </div>
    </section>
  \`;
}

function renderProjectCarousel(category) {
  const projects = getProjects(category);
  const project = projects[state.categoryIndex];

  return \`
    <section class="carousel-section" aria-labelledby="carousel-\${escapeHtml(category)}">
      <div class="carousel-heading">
        <h2 id="carousel-\${escapeHtml(category)}">\${escapeHtml(category)}</h2>
        <div class="carousel-controls">
          <button data-carousel="previous" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'} aria-label="\${escapeHtml(category)} previous project">←</button>
          <button data-carousel="next" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'} aria-label="\${escapeHtml(category)} next project">→</button>
        </div>
      </div>
      \${project ? \`
        <button class="project-preview" data-route="\${encodeRoute(category, project.slug)}">
          <span>\${escapeHtml(project.title)}</span>
          <span>\${escapeHtml(project.publishedAt)}</span>
        </button>
      \` : \`
        <div class="empty-project" role="status">
          작업물 자산을 준비 중입니다.
          <span>프로젝트 정보와 미디어가 추가되면 최신순으로 표시됩니다.</span>
        </div>
      \`}
    </section>
  \`;
}

function renderHome() {
  return \`
    <main class="page-content">
      \${renderAbout()}
      <section class="work-section" id="works">
        <p class="work-intro">Selected works, in reverse chronological order.</p>
        <div class="carousel-list">
          \${categories.map(renderProjectCarousel).join('')}
        </div>
      </section>
      <button class="top-button" data-action="top">Back to top ↑</button>
    </main>
  \`;
}

function getCategoryRoute() {
  const parts = state.route.split('/').slice(1).map((part) => decodeURIComponent(part));
  return { category: parts[0] || null, slug: parts[1] || null };
}

function renderCategory() {
  const { category, slug } = getCategoryRoute();
  const projects = getProjects(category);
  const selectedIndex = slug
    ? Math.max(0, projects.findIndex((project) => project.slug === slug))
    : state.categoryIndex;
  const project = projects[selectedIndex];

  return \`
    <main class="page-content category-page">
      <div class="category-nav">
        <button data-category-action="previous" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'}>← Previous</button>
        <div class="category-title">
          <p>\${escapeHtml(category)}</p>
          <h1>\${escapeHtml(project?.title ?? 'Projects')}</h1>
          <span>\${escapeHtml(project?.period ?? '작업물 준비 중')}</span>
        </div>
        <button data-category-action="next" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'}>Next →</button>
      </div>
      \${project ? \`
        <article class="project-detail">
          <div class="media-placeholder">
            \${project.media ? \`<img src="\${escapeHtml(project.media)}" alt="\${escapeHtml(project.title)}">\` : 'Media coming soon'}
          </div>
          <div class="project-copy">
            <p>\${escapeHtml(project.description)}</p>
            <dl>
              <div><dt>Role</dt><dd>\${escapeHtml(project.role)}</dd></div>
              <div><dt>Period</dt><dd>\${escapeHtml(project.period)}</dd></div>
            </dl>
          </div>
        </article>
      \` : \`
        <div class="detail-empty">
          <h2>작업물 상세 페이지를 준비 중입니다.</h2>
          <p>프로젝트 정보와 이미지·영상 자산을 제공하면 이 화면에 연결됩니다.</p>
        </div>
      \`}
      <div class="bottom-project-nav">
        <button data-category-action="previous" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'}>← Previous project</button>
        <button data-category-action="next" data-category="\${escapeHtml(category)}" \${projects.length ? '' : 'disabled'}>Next project →</button>
      </div>
    </main>
  \`;
}

function render() {
  const route = getCategoryRoute();
  const isCategory = route.category && categories.includes(route.category);
  const app = document.querySelector('#app');

  app.innerHTML = \`
    <div class="site-shell \${state.loading && !state.loadingLeaving ? 'is-loading' : 'is-ready'}">
      \${renderGnb()}
      \${isCategory ? renderCategory() : renderHome()}
    </div>
    \${renderLoading()}
  \`;

  bindNameShuffle();
}

function updateLoadingFont() {
  state.loadingFont = randomFont(state.loadingFont);
  const title = document.querySelector('.loading-title');
  if (title) title.querySelectorAll('.loading-word').forEach((word) => {
    word.style.fontFamily = state.loadingFont;
  });
}

function finishLoading() {
  state.loadingLeaving = true;
  render();
  window.setTimeout(() => {
    state.loading = false;
    render();
  }, 450);
}

function startLoading() {
  window.setTimeout(() => {
    loadingInterval = window.setInterval(updateLoadingFont, 300);
  }, 1200);

  window.setTimeout(() => {
    window.clearInterval(loadingInterval);
    finishLoading();
  }, 3000);
}

function shuffleName() {
  const now = performance.now();
  if (now - state.lastShuffleAt < 400) return;

  state.lastShuffleAt = now;
  window.cancelAnimationFrame(nameShuffleFrame);
  nameShuffleFrame = window.requestAnimationFrame(() => {
    state.nameFont = randomFont(state.nameFont);
    const name = document.querySelector('#name-display');
    if (name) name.style.fontFamily = state.nameFont;
  });
}

function bindNameShuffle() {
  const name = document.querySelector('[data-name-shuffle]');
  if (!name || name.dataset.bound) return;

  name.dataset.bound = 'true';
  name.addEventListener('pointerenter', () => {
    state.lastPointer = null;
    shuffleName();
  });
  name.addEventListener('pointermove', (event) => {
    const point = { x: event.clientX, y: event.clientY };
    const previous = state.lastPointer;
    state.lastPointer = point;
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) >= 32) shuffleName();
  });
  name.addEventListener('focus', shuffleName);
}

document.addEventListener('click', (event) => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) {
    navigate(routeTarget.dataset.route);
    return;
  }

  const carouselTarget = event.target.closest('[data-carousel]');
  if (carouselTarget) {
    const projects = getProjects(carouselTarget.dataset.category);
    if (!projects.length) return;
    const direction = carouselTarget.dataset.carousel === 'next' ? 1 : -1;
    state.categoryIndex = (state.categoryIndex + direction + projects.length) % projects.length;
    render();
    return;
  }

  const categoryTarget = event.target.closest('[data-category-action]');
  if (categoryTarget) {
    const category = categoryTarget.dataset.category;
    const projects = getProjects(category);
    if (!projects.length) return;
    const direction = categoryTarget.dataset.categoryAction === 'next' ? 1 : -1;
    state.categoryIndex = (state.categoryIndex + direction + projects.length) % projects.length;
    render();
    return;
  }

  if (event.target.closest('[data-action="top"]')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

window.addEventListener('hashchange', () => {
  state.route = readRoute();
  state.categoryIndex = 0;
  render();
});

render();
startLoading();
