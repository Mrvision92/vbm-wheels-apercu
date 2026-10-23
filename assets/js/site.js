/**
 * Shared behaviour, loaded on every page (port of the <script> of src/components/layout/Header.astro):
 *  - the "Services" fly-out: hover with a mouse, click/tap, closes on focus loss, scrim click and Escape;
 *  - the mobile menu: a native modal <dialog> (focus trap, Esc, inert page);
 *  - the call picker (app/views/partials/call-picker.php, not in the reference): every generic
 *    call link (data-call, a tel: link to the main number) opens it instead of dialling.
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
  // A link closes the menu, except the call line: the call picker opens over it, and « Annuler »
  // leads back to the menu.
  dialog.querySelectorAll('a:not([data-call])').forEach((a) => a.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('menu-open');
    opener.focus();
  });
  // Leaving the mobile layout (rotation, resize) closes the menu.
  window.matchMedia('(min-width: 64rem)').addEventListener('change', (e) => {
    if (e.matches && dialog.open) dialog.close();
  });
}

// Call picker: each centre has its own line. A generic call link (data-call) dials the main number
// without JavaScript; here it opens the native modal dialog listing the centres of the page's
// trade, each row a tel: link to that centre. Escape, « Annuler », a click on the backdrop or the
// choice of a centre close it; focus starts on its title and returns to the link. If the dialog
// cannot open, the link simply dials the main number.
const picker = document.querySelector('[data-call-picker]');

if (picker && typeof picker.showModal === 'function') {
  const heading = picker.querySelector('#call-title');
  const root = document.documentElement;
  let caller = null;
  let openedAt = 0;
  let chosen = false;

  // The page stops scrolling (html.call-open), so its scrollbar goes. Where it took room (the
  // window wider than the page), the page would widen and shift sideways: that width is given
  // back (--call-gap, components.css).
  const lock = () => {
    const gap = window.innerWidth - root.clientWidth;
    if (gap > 0) root.style.setProperty('--call-gap', `${gap}px`);
    root.classList.add('call-open');
  };

  document.querySelectorAll('[data-call]').forEach((a) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.setAttribute('aria-controls', picker.id);
  });
  // Delegated, so a link shown later (the quote form's success panel) works too.
  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest('[data-call]') : null;
    if (!link || picker.open) return;
    try {
      picker.showModal();
    } catch {
      return;
    }
    e.preventDefault();
    caller = link;
    chosen = false;
    openedAt = performance.now();
    lock();
    heading?.focus();
  });
  // The second click of a double-click (or double tap) on the link lands in the dialog just
  // opened: on a row it would dial that centre, on the backdrop close the dialog, and its press
  // would move the focus off the title. It is ignored: a repeated click (detail above 1), or a
  // single one while the dialog is still opening (some browsers count each tap of a double tap
  // as one). A click from the keyboard has a detail of 0 and always goes through.
  const stray = (e) => e.detail > 1 || (e.detail === 1 && performance.now() - openedAt < 250);
  picker.addEventListener('mousedown', (e) => {
    if (stray(e)) e.preventDefault();
  }, true);
  picker.addEventListener('click', (e) => {
    if (stray(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  picker.querySelector('[data-call-close]')?.addEventListener('click', () => picker.close());
  // Choosing a centre: the tel: link dials, the dialog closes.
  picker.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    chosen = true;
    picker.close();
  }));
  // A click on the backdrop closes it (only when the press also started there).
  let pressedOutside = false;
  picker.addEventListener('pointerdown', (e) => {
    pressedOutside = e.target === picker;
  });
  picker.addEventListener('click', (e) => {
    if (pressedOutside && e.target === picker) picker.close();
  });
  picker.addEventListener('close', () => {
    root.classList.remove('call-open');
    root.style.removeProperty('--call-gap');
    // Opened from the mobile menu: once a centre is chosen, the menu closes too (and hands the
    // focus to its button); « Annuler » or Escape lead back to the menu.
    const menu = caller?.closest('dialog[open]');
    if (chosen && menu) {
      menu.close();
    } else {
      // A link that was hidden meanwhile (the fly-out closes when focus leaves it) hands the
      // focus to the control that shows it.
      const hidden = caller?.closest('[hidden]');
      (hidden?.id ? document.querySelector(`[aria-controls="${CSS.escape(hidden.id)}"]`) : caller)?.focus();
    }
    caller = null;
  });
}
