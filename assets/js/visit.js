/**
 * "Visit" section (home, /centres/, /contact/) — port of the <script> of
 * src/components/home/Visit.astro: hovering or focusing a centre highlights its pin on the map.
 */
document.querySelectorAll('[data-centres]').forEach((root) => {
  const pins = root.querySelectorAll('[data-pin]');
  const set = (id) => pins.forEach((p) => p.classList.toggle('is-active', p.dataset.pin === id));
  root.querySelectorAll('[data-centre]').forEach((row) => {
    row.addEventListener('pointerenter', () => set(row.dataset.centre ?? null));
    row.addEventListener('focusin', () => set(row.dataset.centre ?? null));
  });
  root.addEventListener('pointerleave', () => set(null));
});
