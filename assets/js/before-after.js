/**
 * Before / after sliders (partials/before-after.php) — port of the <script> of
 * src/components/visuals/BeforeAfter.astro: the range input drives the split position (--pos)
 * and its spoken value; the knob shrinks while it is dragged.
 */
document.querySelectorAll('[data-ba]').forEach((root) => {
  const range = root.querySelector('.ba__range');
  if (!range) return;
  const update = () => {
    root.style.setProperty('--pos', `${range.value}%`);
    range.setAttribute('aria-valuetext', `${range.value} % — avant à gauche, après à droite`);
  };
  range.addEventListener('input', update);
  range.addEventListener('pointerdown', () => root.classList.add('is-dragging'));
  window.addEventListener('pointerup', () => root.classList.remove('is-dragging'));
});
