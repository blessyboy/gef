'use strict';
(() => {
  const hero = document.getElementById('gef-hero');
  if (!hero) return;
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const controls = hero.querySelector('.hero-slider-controls');
  const dots = [...hero.querySelectorAll('[data-hero-slide]')];
  const toggle = hero.querySelector('[data-hero-toggle]');
  const progress = hero.querySelector('.hero-progress-fill');
  const count = hero.querySelector('.hero-slide-count');
  const status = document.getElementById('hero-slider-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval = 4000;
  let index = 0, elapsed = 0, previousTime = 0, frameId = 0, version = 0;
  let userPaused = motion.matches, hoverPaused = false, inView = true, loading = false;
  controls.hidden = false;

  function playing() { return !userPaused && !hoverPaused && !document.hidden && inView; }
  function frame(time) {
    frameId = 0;
    if (!playing()) return;
    if (previousTime && !loading) elapsed = Math.min(interval, elapsed + time - previousTime);
    previousTime = time;
    progress.style.transform = `scaleX(${elapsed / interval})`;
    if (elapsed >= interval && !loading) show(index + 1, false);
    frameId = requestAnimationFrame(frame);
  }
  function sync() {
    cancelAnimationFrame(frameId); frameId = 0; previousTime = 0;
    toggle.setAttribute('aria-label', userPaused ? 'Play automatic slides' : 'Pause automatic slides');
    toggle.querySelector('span').textContent = userPaused ? '\u25b6' : '\u275a\u275a';
    hero.dataset.playing = String(playing());
    if (playing()) frameId = requestAnimationFrame(frame);
  }
  async function loadImage(slide) {
    const image = slide.querySelector('img');
    if (image.dataset.src) {
      image.loading = 'eager'; image.src = image.dataset.src; delete image.dataset.src;
    }
    if (typeof image.decode === 'function') {
      try { await image.decode(); } catch { /* Keep readable text over the branded fallback. */ }
    }
  }
  async function show(next, manual = true) {
    next = (next + slides.length) % slides.length;
    const currentVersion = ++version;
    loading = true;
    await loadImage(slides[next]);
    if (currentVersion !== version) return;
    index = next; loading = false; elapsed = 0;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active)); slide.inert = !active;
      slide.querySelectorAll('a').forEach(link => { if (active) link.removeAttribute('tabindex'); else link.tabIndex = -1; });
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    count.textContent = `${String(index + 1).padStart(2, '0')} / 03`;
    progress.style.transform = 'scaleX(0)';
    if (manual) status.textContent = `Slide ${index + 1} of 3: ${slides[index].querySelector('.hero-slide-title').textContent}`;
    sync();
  }
  function manual(next) { userPaused = true; show(next); sync(); }
  hero.querySelector('[data-hero-previous]').addEventListener('click', () => manual(index - 1));
  hero.querySelector('[data-hero-next]').addEventListener('click', () => manual(index + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => manual(i)));
  toggle.addEventListener('click', () => { userPaused = !userPaused; sync(); });
  hero.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); manual(index + (event.key === 'ArrowRight' ? 1 : -1)); }
  });
  hero.addEventListener('focusin', event => { if (!toggle.contains(event.target)) { userPaused = true; sync(); } });
  hero.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hoverPaused = true; sync(); } });
  hero.addEventListener('pointerleave', () => { hoverPaused = false; sync(); });
  let pointer;
  hero.addEventListener('pointerdown', event => { if (event.pointerType === 'touch' && !event.target.closest('a,button')) pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }; });
  hero.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) manual(index + (dx < 0 ? 1 : -1));
  });
  hero.addEventListener('pointercancel', () => { pointer = null; });
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', event => { if (event.matches) userPaused = true; sync(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); }, { threshold: .05 }).observe(hero);

  document.body.classList.add('hero-slider-ready');
  sync();
})();
