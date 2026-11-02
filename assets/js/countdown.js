'use strict';
(() => {
  const section = document.querySelector('[data-event-start]');
  if (!section) return;
  // Explicit UTC = Accra/GMT. Never interpret the event in the visitor's timezone.
  const target = Date.parse(section.dataset.eventStart);
  const status = section.querySelector('[data-countdown-status]');
  const fields = ['days', 'hours', 'minutes', 'seconds'];
  const values = fields.map(name => section.querySelector(`[data-countdown="${name}"]`));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer, visible = true, revealed = false;
  if (!Number.isFinite(target)) { status.textContent = 'The forum begins November 10, 2026 at 8:00 AM GMT.'; return; }

  function update() {
    const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    const numbers = [Math.floor(remaining / 86400), Math.floor(remaining % 86400 / 3600), Math.floor(remaining % 3600 / 60), remaining % 60];
    numbers.forEach((number, i) => {
      const next = String(number).padStart(2, '0');
      const element = values[i];
      if (element.textContent === next) return;
      const wasInitialized = /^\d+$/.test(element.textContent);
      element.textContent = next;
      if (wasInitialized && visible && !document.hidden && !motion.matches && typeof element.animate === 'function') {
        element.animate([{ opacity: .55, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
      }
    });
    if (remaining === 0) {
      section.classList.add('is-started');
      status.textContent = 'The Event Has Started';
      clearInterval(timer); timer = undefined;
    }
    return remaining;
  }
  // Derive every tick from the clock, not a decrementing counter: no interval drift.
  if (update() > 0) timer = setInterval(update, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  window.addEventListener('pageshow', update);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible || revealed) return;
      revealed = true;
      if (!motion.matches && typeof section.animate === 'function') {
        section.querySelectorAll('.countdown-card').forEach((card, i) => card.animate(
          [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 650, delay: i * 65, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }
        ));
      }
    }, { threshold: .15 });
    observer.observe(section);
  }
})();
