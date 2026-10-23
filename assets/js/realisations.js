/**
 * Gallery page (/realisations/) — port of the <script> of src/pages/realisations.astro.
 * Only loaded once app/data/projects.php lists projects (see app/routes.php).
 *
 * - Filters: shown only with JavaScript; each button keeps the projects of one intervention.
 * - Viewer: a <dialog> with one slide per project. It opens on the clicked card, steps through
 *   the projects left visible by the filter (buttons or arrow keys, except while a before /
 *   after slider has focus), closes on the button, Escape or a click on the backdrop, and
 *   gives focus back to the card that opened it.
 */
const root = document.querySelector('[data-gallery]');
if (root) {
  const items = [...root.querySelectorAll('.gallery__item')];
  const filters = root.querySelector('[data-filters]');
  if (filters) {
    filters.hidden = false;
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const f = btn.dataset.filter;
      filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      items.forEach((it) => (it.hidden = f !== 'all' && !(it.dataset.services ?? '').split(' ').includes(f)));
    });
  }

  const viewer = root.querySelector('[data-viewer]');
  const slides = [...viewer.querySelectorAll('[data-slide]')];
  const title = viewer.querySelector('[data-viewer-title]');
  let index = 0;
  let opener = null;
  const visible = () => items.map((it, i) => (it.hidden ? -1 : i)).filter((i) => i >= 0);
  const go = (i) => {
    index = i;
    slides.forEach((s) => (s.hidden = Number(s.dataset.slide) !== i));
    const v = visible();
    title.textContent = `${v.indexOf(i) + 1} / ${v.length}`;
  };
  root.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', () => {
      opener = b;
      go(Number(b.dataset.open));
      viewer.showModal();
    }),
  );
  const step = (d) => {
    const v = visible();
    const pos = v.indexOf(index);
    go(v[(pos + d + v.length) % v.length]);
  };
  viewer.querySelector('[data-viewer-prev]').addEventListener('click', () => step(-1));
  viewer.querySelector('[data-viewer-next]').addEventListener('click', () => step(1));
  viewer.querySelector('[data-viewer-close]').addEventListener('click', () => viewer.close());
  viewer.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type="range"]')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) viewer.close();
  });
  viewer.addEventListener('close', () => opener?.focus());
}
