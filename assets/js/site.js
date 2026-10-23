/**
 * Shared behaviour, loaded on every page (port of the <script> of src/components/layout/Header.astro):
 *  - the "Services" fly-out: hover with a mouse, click/tap, closes on focus loss, scrim click and Escape;
 *  - the mobile menu: a native modal <dialog> (focus trap, Esc, inert page).
 */

// Services fly-out.
const nav = document.querySelector('[data-nav]');
const item = document.querySelector('[data-flyout]');
const trigger = document.querySelector('[data-flyout-trigger]');
const panel = document.querySelector('[data-flyout-panel]');
const scrim = document.querySelector('[data-flyout-scrim]');

if (nav && item && trigger && panel && scrim) {
  let timer;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const set = (open) => {
    window.clearTimeout(timer);
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    scrim.hidden = !open;
    nav.classList.toggle('is-open', open);
  };
  trigger.addEventListener('click', () => set(trigger.getAttribute('aria-expanded') !== 'true'));
  const enter = (e) => {
    if (fine.matches && e.pointerType === 'mouse') set(true);
  };
  // A short delay lets the pointer travel from the trigger to the panel.
  const leave = (e) => {
    if (fine.matches && e.pointerType === 'mouse') timer = window.setTimeout(() => set(false), 160);
  };
  item.addEventListener('pointerenter', enter);
  panel.addEventListener('pointerenter', () => window.clearTimeout(timer));
  item.addEventListener('pointerleave', leave);
  panel.addEventListener('pointerleave', leave);
  scrim.addEventListener('click', () => set(false));
  nav.addEventListener('focusout', (e) => {
    if (!nav.contains(e.relatedTarget)) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      set(false);
      trigger.focus();
    }
  });
}

// Mobile menu: native modal dialog.
const dialog = document.querySelector('[data-menu]');
const opener = document.querySelector('[data-menu-open]');

if (dialog && opener) {
  opener.addEventListener('click', () => {
    dialog.showModal();
    document.documentElement.classList.add('menu-open');
  });
  dialog.querySelector('[data-menu-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('menu-open');
    opener.focus();
  });
  // Leaving the mobile layout (rotation, resize) closes the menu.
  window.matchMedia('(min-width: 64rem)').addEventListener('change', (e) => {
    if (e.matches && dialog.open) dialog.close();
  });
}
