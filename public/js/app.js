import { refreshSession } from './api.js';
import { renderPage } from './router.js';
window.addEventListener('hashchange', renderPage);
window.matchMedia('(max-width:900px)').addEventListener('change', (event) => {
  if (!event.matches) document.querySelector('#sidebar-close')?.click();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.querySelector('.workspace')?.classList.contains('menu-open')) document.querySelector('#sidebar-close')?.click();
});
try { await refreshSession(); } catch { /* An expired session returns to sign-in. */ }
await renderPage();
