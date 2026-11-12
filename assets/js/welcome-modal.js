(() => {
  const dialog = document.getElementById('welcome-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const storageKey = 'gef2026WelcomeDismissed';
  let dismissedThisSession = false;
  try {
    dismissedThisSession = window.sessionStorage.getItem(storageKey) === '1';
  } catch {
    // Private browsing and restricted storage still get an in-memory session fallback.
  }
  if (dismissedThisSession) return;

  const closeButton = dialog.querySelector('[data-welcome-close]');
  let closeTimer;
  const dismiss = () => {
    if (!dialog.open) return;
    try { window.sessionStorage.setItem(storageKey, '1'); } catch { /* In-memory dismissal still applies. */ }
    document.body.classList.remove('welcome-dialog-open');
    dialog.classList.add('is-closing');
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (dialog.open) dialog.close();
      dialog.classList.remove('is-closing');
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  };

  closeButton?.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dismiss();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('welcome-dialog-open'));

  // Show after parsing and the first paint so the dialog never blocks page rendering.
  const show = () => {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', function onVisible() {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onVisible);
        show();
      });
      return;
    }
    if (dialog.open || dismissedThisSession) return;
    dialog.showModal();
    document.body.classList.add('welcome-dialog-open');
    closeButton?.focus({ preventScroll: true });
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(show, { timeout: 1200 });
  else window.setTimeout(show, 250);
})();
