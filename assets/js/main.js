"use strict";
const toggle = document.querySelector('.nav-toggle');
const navigation = document.querySelector('#navigation');
function closeNavigation() { navigation.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open navigation'); }
toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; navigation.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { closeNavigation(); toggle.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.nav-shell')) closeNavigation(); });
window.matchMedia('(min-width: 768px)').addEventListener('change', event => { if(event.matches) closeNavigation(); });
const filters = document.querySelectorAll('[data-filter]');
filters.forEach(button => button.addEventListener('click', () => { filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button))); let count = 0; document.querySelectorAll('[data-category]').forEach(speaker => { speaker.hidden = button.dataset.filter !== 'All' && speaker.dataset.category !== button.dataset.filter; if (!speaker.hidden) count++; }); document.getElementById('filter-status').textContent = `${count} speakers shown`; }));

// Animate on entry without hiding content when JavaScript or animation support is absent.
const conversationItems = document.querySelectorAll('[data-conversation-reveal]');
const conversationMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function' && !conversationMotion.matches) {
  const conversationObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      conversationObserver.unobserve(entry.target);
      if (conversationMotion.matches) return;
      const fadeOnly = entry.target.dataset.conversationReveal === 'fade';
      const animation = entry.target.animate([
        { opacity: 0, transform: fadeOnly ? 'none' : 'translateY(18px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: fadeOnly ? 800 : 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'none' });
      const stopForReducedMotion = event => { if (event.matches) animation.finish(); };
      conversationMotion.addEventListener('change', stopForReducedMotion);
      animation.finished.then(() => conversationMotion.removeEventListener('change', stopForReducedMotion));
    });
  }, { threshold: 0.12 });
  conversationItems.forEach(item => conversationObserver.observe(item));
}
