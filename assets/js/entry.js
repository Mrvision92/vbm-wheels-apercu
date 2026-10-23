/**
 * Entry page (/: app/views/pages/entry.php, styles entry.css):
 *  - the light (.entry-spot) follows the mouse and rests on the headline when the pointer leaves;
 *  - after 120 ms of hover, on keyboard focus or on a still touch, a trade plays its gesture (the
 *    tyre rolls, the rim turns one spoke, the disc spins and the caliper bites), never again
 *    within 2.5 s;
 *  - a trade below the fold arrives once, when 15 % of it is in view;
 *  - a click keeps the chosen trade while the rest fades out (180 ms), then follows its link
 *    (its href as rendered, so the static preview's base path carries over).
 * Nothing moves for reduced motion (the links then work as plain links).
 */

const doc = document.documentElement;
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
const items = [...document.querySelectorAll('.entry-trade')];
const raf = window.requestAnimationFrame;
const r2 = (n) => Math.round(n * 100) / 100;

// The light glides toward its target, frame-rate independent (k = 1 − e^(−dt/180)).
const spot = document.querySelector('.entry-spot');
const rest = () => [window.innerWidth / 2, window.innerHeight * 0.3];
let [x, y] = rest(), tx = x, ty = y, last = 0, gliding = 0;
const glide = (now) => {
  const k = 1 - Math.exp(-(now - (last || now - 16)) / 180);
  last = now;
  x += (tx - x) * k;
  y += (ty - y) * k;
  spot.style.transform = `translate3d(${r2(x)}px,${r2(y)}px,0)`;
  gliding = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? raf(glide) : (last = 0);
};
const aim = (px, py) => {
  if (still.matches || !spot) return;
  tx = px;
  ty = py;
  gliding ||= raf(glide);
};
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') aim(e.clientX, e.clientY);
}, { passive: true });
doc.addEventListener('pointerleave', () => aim(...rest()));

// The tyre rolls: its tread is redrawn and its sidewall mark turned at each frame. The tread's
// geometry comes from data-tread (partials/entry-icons/pneus.php); the ease is the CSS
// cubic-bezier(0.45, 0, 0.15, 1) of the other gestures, solved by Newton's method.
const bez = (a, b, c, d) => (t) => {
  const B = (p, q, u) => 3 * p * u * (1 - u) ** 2 + 3 * q * u * u * (1 - u) + u ** 3;
  let u = t;
  for (let i = 0; i < 8; i++) u -= (B(a, c, u) - t) / (3 * a * (1 - u) ** 2 + 6 * (c - a) * u * (1 - u) + 3 * (1 - c) * u * u);
  return B(b, d, u);
};
const turn = bez(0.45, 0, 0.15, 1);
const tyre = document.querySelector('.ic--tyre');
const roll = tyre && (() => {
  const tread = tyre.querySelector('.ic-tread');
  const mark = tyre.querySelector('.ic-mark');
  // centre, tread width, edge and middle radii, pitch, lag of the middle point (degrees), edge
  // inset, visible half-angle, start phase
  const [cx, cy, W, rE, rM, P, D, E, A, ph0] = tread.dataset.tread.split(' ').map(Number);
  // three-quarter view: the tyre's plane is turned 32° about the vertical axis
  const C = Math.cos(Math.PI * 32 / 180), S = Math.sin(Math.PI * 32 / 180);
  const pt = (th, z, r) => [cx + r * Math.cos(th * Math.PI / 180) * C + z * S, cy + r * Math.sin(th * Math.PI / 180)];
  const xy = (p) => `${r2(p[0])} ${r2(p[1])}`;
  const toward = (m, p, f) => xy([m[0] + (p[0] - m[0]) * f, m[1] + (p[1] - m[1]) * f]);
  // one chevron per pitch, shortened as it turns away round the edge of the visible face
  const d = (ph) => {
    let s = '';
    for (let k = Math.floor((A - ph) / P); k >= Math.ceil((-A - ph) / P); k--) {
      const th = ph + k * P, f = Math.max(0, Math.min(1, (A - Math.abs(th)) / 12)), m = pt(th - D, W / 2, rM);
      s += `M${toward(m, pt(th, E * W, rE), f)}L${xy(m)}L${toward(m, pt(th, (1 - E) * W, rE), f)}`;
    }
    return s;
  };
  let at = 0; // the mark keeps the angle the tyre was left at
  return () => {
    const t0 = performance.now(), from = at;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900), a = from - 5 * P * turn(k); // a third of a turn, backward
      tread.setAttribute('d', d(ph0 + (((a % P) + P) % P)));
      mark.style.transform = `scaleX(${C}) rotate(${r2(a)}deg) scaleX(${1 / C})`;
      if (k < 1) raf(step);
      else at = a % 360;
    };
    raf(step);
  };
})();

// Gestures: the CSS animations of .is-play (entry.css), restarted by a reflow.
const play = (item) => {
  const now = performance.now();
  if (still.matches || now - (item.t ?? -1e4) < 2500) return;
  item.t = now;
  if (roll && item.contains(tyre)) roll();
  item.classList.remove('is-play');
  void item.offsetWidth;
  item.classList.add('is-play');
  window.clearTimeout(item.done);
  item.done = window.setTimeout(() => item.classList.remove('is-play'), 1100);
};

for (const item of items) {
  let wait = 0, from = null;
  const hold = (touch) => {
    window.clearTimeout(wait);
    wait = window.setTimeout(() => {
      if (touch) item.classList.add('is-press');
      play(item);
    }, 120);
  };
  const drop = () => {
    window.clearTimeout(wait);
    from = null;
    item.classList.remove('is-press');
  };
  item.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hold();
  });
  item.addEventListener('pointerleave', drop);
  // Touch: only a still press (120 ms, less than 6 px of travel) plays it, never a scroll.
  item.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') {
      from = [e.clientX, e.clientY];
      hold(true);
    }
  });
  item.addEventListener('pointermove', (e) => {
    if (from && Math.hypot(e.clientX - from[0], e.clientY - from[1]) > 6) drop();
  });
  item.addEventListener('pointerup', drop);
  item.addEventListener('pointercancel', drop);
  // Keyboard focus: the gesture, and the light moves onto the object.
  item.addEventListener('focus', () => {
    if (!item.matches(':focus-visible')) return;
    play(item);
    const r = item.querySelector('.entry-trade__icon').getBoundingClientRect();
    aim(r.left + r.width / 2, r.top + r.height * 0.6);
  });
  // A plain click: the exit (.is-leaving, entry.css), then the page changes. Modified clicks
  // (new tab, new window) and reduced motion keep the link's own behaviour.
  item.addEventListener('click', (e) => {
    if (still.matches || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    play(item);
    item.classList.add('is-chosen');
    doc.classList.add('is-leaving');
    window.setTimeout(() => window.location.assign(item.href), 180);
  });
}

// Lets :active style a touch press (iOS).
window.addEventListener('touchstart', () => {}, { passive: true });
// Back to the page from the history cache: the exit state is undone.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  doc.classList.remove('is-leaving');
  items.forEach((i) => i.classList.remove('is-chosen', 'is-play', 'is-press'));
});

// Below the fold: a trade waits (.is-wait) and arrives once, when 15 % of it is in view (.is-in).
if (!still.matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const { target: el, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      io.unobserve(el);
      el.classList.replace('is-wait', 'is-in');
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
  for (const el of items) {
    if (el.getBoundingClientRect().top > window.innerHeight * 0.85) el.classList.add('is-wait');
    io.observe(el);
  }
}
