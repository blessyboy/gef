'use strict';
(() => {
  const section = document.querySelector('.speaker-showcase');
  const dialog = document.getElementById('speaker-dialog');
  const data = document.getElementById('speaker-profile-data');
  if (!section || !dialog || !data) return;
  let profiles;
  try { profiles = new Map(JSON.parse(data.textContent).map(profile => [profile.slug, profile])); }
  catch { return; }
  let opener;
  const cards = [...section.querySelectorAll('[data-speaker]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const photo = document.getElementById('speaker-dialog-photo');
  const setText = (id, text) => { document.getElementById(id).textContent = text; };

  if (typeof dialog.showModal === 'function') {
    section.querySelectorAll('[data-open-speaker]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => {
        const profile = profiles.get(button.dataset.openSpeaker);
        if (!profile) return;
        opener = button;
        const portrait = button.closest('.speaker-card').querySelector('.portrait').cloneNode(true);
        portrait.querySelector('.speaker-featured-badge')?.remove();
        portrait.querySelector('img').loading = 'eager';
        photo.replaceChildren(portrait);
        setText('speaker-dialog-name', profile.name);
        setText('speaker-dialog-role', profile.title);
        setText('speaker-dialog-org', profile.organization || 'Organization to be announced');
        setText('speaker-dialog-biography', profile.biography || 'Biography to be announced. Full speaker profiles will be added as they become available.');
        const category = document.getElementById('speaker-dialog-category');
        category.textContent = profile.category;
        category.className = `speaker-category category-${profile.category.toLowerCase()}`;
        const expertise = document.getElementById('speaker-dialog-expertise');
        const list = expertise.querySelector('ul'); list.replaceChildren();
        for (const area of profile.expertise || []) { const li = document.createElement('li'); li.textContent = area; list.append(li); }
        expertise.hidden = !list.children.length;
        const socials = document.getElementById('speaker-dialog-socials'); socials.replaceChildren();
        for (const social of profile.socialLinks || []) {
          let url; try { url = new URL(social.url); } catch { continue; }
          if (url.protocol !== 'https:') continue;
          const link = document.createElement('a'); link.href = url.href; link.textContent = social.label;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `${profile.name} on ${social.label} (opens in a new tab)`);
          socials.append(link);
        }
        socials.hidden = !socials.children.length;
        dialog.showModal(); document.body.classList.add('speaker-dialog-open');
        dialog.scrollTop = 0;
      });
    });
    dialog.querySelector('.speaker-dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      document.body.classList.remove('speaker-dialog-open');
      if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
    });
    // Only close when both pointer events occurred outside the dialog's bounds.
    let backdropDown = false;
    const outside = event => { const rect = dialog.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
    dialog.addEventListener('pointerdown', event => { backdropDown = outside(event); });
    dialog.addEventListener('click', event => { if (backdropDown && outside(event)) dialog.close(); backdropDown = false; });
  }

  const filters = [...section.querySelectorAll('[data-speaker-filter]')];
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    let count = 0;
    cards.forEach(card => { card.hidden = button.dataset.speakerFilter !== 'All' && card.dataset.category !== button.dataset.speakerFilter; if (!card.hidden) count++; });
    document.getElementById('speaker-result-count').textContent = `${count} ${count === 1 ? 'speaker' : 'speakers'}${button.dataset.speakerFilter === 'All' ? ' · Ideas that move us forward' : ` · ${button.dataset.speakerFilter}`}`;
  }));

  if ('IntersectionObserver' in window && typeof Element.prototype.animate === 'function' && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        observer.unobserve(entry.target);
        if (reduceMotion.matches) return;
        const animation = entry.target.animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }],
          { duration: 600, delay: Math.min(index, 3) * 80, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
        const stop = event => { if (event.matches) animation.finish(); };
        reduceMotion.addEventListener('change', stop);
        animation.finished.then(() => reduceMotion.removeEventListener('change', stop));
      });
    }, { threshold: .1 });
    cards.forEach(card => observer.observe(card));
  }
})();
