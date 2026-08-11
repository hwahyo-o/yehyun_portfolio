import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function randomFont(previous) {
  const available = fonts.filter((font) => font !== previous);
  return available[Math.floor(Math.random() * available.length)];
}

function LoadingScreen({ onComplete }) {
  const [font, setFont] = useState(fonts[0]);

  useEffect(() => {
    let interval;
    const shuffleStart = window.setTimeout(() => {
      interval = window.setInterval(() => setFont((current) => randomFont(current)), 300);
    }, 1200);
    const stopShuffle = window.setTimeout(() => window.clearInterval(interval), 2900);
    const complete = window.setTimeout(onComplete, 3000);

    return () => {
      window.clearTimeout(shuffleStart);
      window.clearTimeout(stopShuffle);
      window.clearTimeout(complete);
      window.clearInterval(interval);
    };
  }, [onComplete]);

  return (
    <section className="loading-screen" aria-label="Portfolio loading">
      <div className="loading-lockup">
        <div className="loading-title" aria-label="Portfolio 2026">
          <span className="loading-word loading-highlight" style={{ fontFamily: font }}>Portfolio</span>
          <span className="loading-word" style={{ fontFamily: font }}>2026</span>
        </div>
        <div className="loading-meta">
          <span>Yang Ye Hyun</span>
          <span className="loading-rule" aria-hidden="true" />
          <span>visual designer / portfolio</span>
        </div>
      </div>
    </section>
  );
}

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || 'home');

  useEffect(() => {
    const update = () => setRoute(window.location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}

function navigate(route) {
  window.location.hash = route === 'home' ? '' : route;
}

function useNameShuffle() {
  const [font, setFont] = useState(fonts[0]);
  const frame = useRef(0);
  const lastPointer = useRef(null);
  const lastShuffleAt = useRef(0);

  const shuffle = useCallback(() => {
    const now = performance.now();
    if (now - lastShuffleAt.current < 400) return;

    lastShuffleAt.current = now;
    window.cancelAnimationFrame(frame.current);
    frame.current = window.requestAnimationFrame(() => setFont((current) => randomFont(current)));
  }, []);

  const shuffleFromPointer = useCallback((event) => {
    const point = { x: event.clientX, y: event.clientY };
    const previous = lastPointer.current;
    lastPointer.current = point;

    if (!previous) return;

    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= 32) shuffle();
  }, [shuffle]);

  const handlePointerEnter = useCallback(() => {
    lastPointer.current = null;
    shuffle();
  }, [shuffle]);

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  return { font, shuffle, shuffleFromPointer, handlePointerEnter };
}

function Gnb() {
  return (
    <header className="gnb">
      <button className="logo-button" onClick={() => navigate('home')} aria-label="YeHyun home">
        YeHyun
      </button>
      <nav aria-label="Portfolio categories">
        {categories.map((category) => (
          <button key={category} onClick={() => navigate('category/' + encodeURIComponent(category))}>
            {category}
          </button>
        ))}
      </nav>
    </header>
  );
}

function AboutMe() {
  const { font, shuffle, shuffleFromPointer, handlePointerEnter } = useNameShuffle();

  return (
    <section className="about-section" id="about">
      <p className="section-label">About Me</p>
      <div className="about-heading-row">
        <button
          className="name-display"
          style={{ fontFamily: font }}
          onPointerEnter={handlePointerEnter}
          onPointerMove={shuffleFromPointer}
          onFocus={shuffle}
          aria-label="Yang Ye Hyun, move the pointer or focus to shuffle the font"
        >
          Yang Ye Hyun
        </button>
        <dl className="contact-list">
          <div><dt>Mail</dt><dd>ajas03974@gmail.com</dd></div>
          <div><dt>Phone</dt><dd>010-6797-0462</dd></div>
        </dl>
        <div className="tool-strip" aria-label="Tools">
          {['Ps', 'Pr', 'Ae', 'Ai', 'Xd', 'VS', 'HTML', 'CSS', 'JS', 'Figma'].map((tool) => (
            <span key={tool} className="tool-chip">{tool}</span>
          ))}
        </div>
      </div>
      <div className="about-divider" />
      <div className="resume-grid">
        <div>
          <p><strong>2015년 입학</strong> 영주 선영여자고등학교 / 미술중점반(디자인)</p>
          <p className="resume-subline">2015년 교내 미술 전시 팜플렛 제작활동</p>
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
  );
}

function ProjectCarousel({ category }) {
  const projects = useMemo(() => getProjects(category), [category]);
  const [index, setIndex] = useState(0);
  const project = projects[index];

  return (
    <section className="carousel-section" aria-labelledby={'carousel-' + category}>
      <div className="carousel-heading">
        <h2 id={'carousel-' + category}>{category}</h2>
        <div className="carousel-controls">
          <button disabled={!projects.length} onClick={() => setIndex((index - 1 + projects.length) % projects.length)} aria-label={category + ' previous project'}>←</button>
          <button disabled={!projects.length} onClick={() => setIndex((index + 1) % projects.length)} aria-label={category + ' next project'}>→</button>
        </div>
      </div>
      {project ? (
        <button className="project-preview" onClick={() => navigate('category/' + encodeURIComponent(category) + '/' + project.slug)}>
          <span>{project.title}</span>
          <span>{project.publishedAt}</span>
        </button>
      ) : (
        <div className="empty-project" role="status">
          작업물 자산을 준비 중입니다.
          <span>프로젝트 정보와 미디어가 추가되면 최신순으로 표시됩니다.</span>
        </div>
      )}
    </section>
  );
}

function HomePage() {
  return (
    <main className="page-content">
      <AboutMe />
      <section className="work-section" id="works">
        <p className="work-intro">Selected works, in reverse chronological order.</p>
        <div className="carousel-list">
          {categories.map((category) => <ProjectCarousel key={category} category={category} />)}
        </div>
      </section>
      <button className="top-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
    </main>
  );
}

function CategoryPage({ category }) {
  const projects = getProjects(category);
  const [index, setIndex] = useState(0);
  const project = projects[index];

  return (
    <main className="page-content category-page">
      <div className="category-nav">
        <button disabled={!projects.length} onClick={() => setIndex((index - 1 + projects.length) % projects.length)}>← Previous</button>
        <div className="category-title">
          <p>{category}</p>
          <h1>{project?.title ?? 'Projects'}</h1>
          <span>{project?.period ?? '작업물 준비 중'}</span>
        </div>
        <button disabled={!projects.length} onClick={() => setIndex((index + 1) % projects.length)}>Next →</button>
      </div>
      {project ? (
        <article className="project-detail">
          <div className="media-placeholder">{project.media ? <img src={project.media} alt="" /> : 'Media coming soon'}</div>
          <div className="project-copy">
            <p>{project.description}</p>
            <dl><div><dt>Role</dt><dd>{project.role}</dd></div><div><dt>Period</dt><dd>{project.period}</dd></div></dl>
          </div>
        </article>
      ) : (
        <div className="detail-empty">
          <h2>작업물 상세 페이지를 준비 중입니다.</h2>
          <p>프로젝트 정보와 이미지·영상 자산을 제공하면 이 화면에 연결됩니다.</p>
        </div>
      )}
      <div className="bottom-project-nav">
        <button disabled={!projects.length} onClick={() => setIndex((index - 1 + projects.length) % projects.length)}>← Previous project</button>
        <button disabled={!projects.length} onClick={() => setIndex((index + 1) % projects.length)}>Next project →</button>
      </div>
    </main>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [loadingLeaving, setLoadingLeaving] = useState(false);
  const route = useHashRoute();

  const completeLoading = () => {
    setLoadingLeaving(true);
    window.setTimeout(() => setLoading(false), 450);
  };

  const categoryMatch = route.match(/^category\/([^/]+)/);
  const category = categoryMatch ? decodeURIComponent(categoryMatch[1]) : null;

  return (
    <>
      <div className={'site-shell ' + (loading ? 'is-loading' : 'is-ready')}>
        <Gnb />
        {category && categories.includes(category) ? <CategoryPage category={category} /> : <HomePage />}
      </div>
      {loading && (
        <div className={loadingLeaving ? 'loading-layer is-leaving' : 'loading-layer'}>
          <LoadingScreen onComplete={completeLoading} />
        </div>
      )}
    </>
  );
}

export default App;
