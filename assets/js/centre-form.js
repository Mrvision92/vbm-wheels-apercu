/**
 * Centre form of /pneus/ and /entretien-mecanique/ (app/views/forms/centre-form.php, page
 * app/views/pages/universe.php).
 *
 * Without this script the form sits in the page's #contact section, with a centre selector, and
 * posts normally to /api/devis.php. With it:
 *  - the form moves into the page's modal <dialog>; each « Contactez-nous » button opens it with
 *    its centre preselected (the selector is then hidden) and named in the dialog title;
 *  - the native modal dialog keeps focus inside and makes the page inert; Escape, the close
 *    button or a click on the backdrop close it, and focus returns to the button that opened it;
 *  - inline validation with an error summary, fetch() submission with a JSON answer, then a
 *    success panel inside the dialog.
 * The texts of each centre (title, address, phone, confirmation) are the data-* attributes of its
 * <option>, written by the server. The anti-bot token is rendered by the server
 * (form_token_field()): never overwrite it.
 * Preview build (<html data-preview>, tools/export-static.php): a valid form is not sent; a notice
 * says so instead.
 */

const PREVIEW = document.documentElement.hasAttribute('data-preview');
const dialog = document.querySelector('[data-centre-dialog]');
const wrap = document.querySelector('[data-centre-form-wrap]');
const section = document.querySelector('[data-centre-section]');

if (dialog && wrap && section && typeof dialog.showModal === 'function') {
  const form = wrap.querySelector('[data-centre-form]');
  const success = wrap.querySelector('[data-centre-success]');
  const successText = success.querySelector('[data-success-text]');
  const select = form.elements.namedItem('centre');
  const centreField = form.querySelector('[data-field="centre"]');
  const title = dialog.querySelector('[data-dialog-title]');
  const address = dialog.querySelector('[data-dialog-addr]');
  const summary = form.querySelector('[data-summary]');
  const summaryList = form.querySelector('[data-summary-list]');
  const status = form.querySelector('[data-status]');
  const btn = form.querySelector('[data-submit]');
  const defaultTitle = title.textContent;
  let opener = null;

  // The dialog replaces the page section.
  dialog.querySelector('[data-dialog-body]').append(wrap);
  section.hidden = true;
  form.noValidate = true;

  const option = () => select.selectedOptions[0];
  const value = (name) => form.elements.namedItem(name)?.value.trim() ?? '';

  /** Dialog title and address of the selected centre (or the neutral title). */
  const describe = () => {
    const o = option();
    title.textContent = o?.value ? o.dataset.title : defaultTitle;
    address.textContent = o?.value ? o.dataset.address : '';
  };

  /** Back to an empty form (after a message was sent). */
  const reset = () => {
    form.reset();
    show({});
    status.textContent = '';
    form.hidden = false;
    success.hidden = true;
  };

  /**
   * Shows the given errors (field → message) next to their fields and in the summary, and clears
   * the others. A field hidden in the dialog (the centre) only appears in the summary.
   */
  const show = (errors) => {
    summaryList.replaceChildren();
    form.querySelectorAll('[data-field]').forEach((f) => {
      const k = f.dataset.field;
      const msg = f.querySelector('[data-error]');
      const input = f.querySelector('input, textarea, select');
      const on = Boolean(errors[k]);
      f.classList.toggle('has-error', on);
      if (on) input?.setAttribute('aria-invalid', 'true');
      else input?.removeAttribute('aria-invalid');
      if (msg) msg.textContent = on ? errors[k] : '';
      if (on) {
        const li = document.createElement('li');
        if (f.hidden || !input) {
          li.textContent = `${f.dataset.label} : ${errors[k]}`;
        } else {
          const a = document.createElement('a');
          a.href = `#${input.id}`;
          a.textContent = `${f.dataset.label} : ${errors[k]}`;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            input.focus();
          });
          li.append(a);
        }
        summaryList.append(li);
      }
    });
    summary.hidden = summaryList.childElementCount === 0;
  };

  const validate = () => {
    const errors = {};
    if (!value('centre')) errors.centre = 'Choisissez un centre.';
    if (value('nom').length < 2) errors.nom = 'Indiquez votre nom.';
    if (!value('prenom')) errors.prenom = 'Indiquez votre prénom.';
    if (!/^[0-9 +().\/-]{6,30}$/.test(value('telephone'))) errors.telephone = 'Indiquez un numéro de téléphone valide.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value('email'))) errors.email = 'Indiquez une adresse e-mail valide.';
    if (value('message').length < 10) errors.message = 'Écrivez votre message (au moins quelques mots).';
    return errors;
  };

  /** Opens the dialog for centre $id (null: the visitor chooses it in the form). */
  const open = (id, from) => {
    opener = from;
    if (!success.hidden) reset();
    if (id) select.value = id;
    centreField.hidden = Boolean(id && select.value === id);
    describe();
    dialog.showModal();
    document.documentElement.classList.add('has-modal');
    (centreField.hidden ? form.elements.namedItem('nom') : select).focus();
  };

  document.querySelectorAll('[data-contact-centre]').forEach((a) => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(a.dataset.contactCentre, a);
    });
  });

  select.addEventListener('change', describe);
  dialog.querySelectorAll('[data-dialog-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  // A click on the backdrop closes the dialog (only when the press also started there, so that
  // selecting text in a field and releasing outside does not).
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = e.target === dialog;
  });
  dialog.addEventListener('click', (e) => {
    if (pressedOutside && e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-modal');
    opener?.focus();
    opener = null;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = validate();
    show(errors);
    if (Object.keys(errors).length) {
      status.textContent = '';
      summary.focus();
      return;
    }
    if (PREVIEW) {
      status.textContent = 'Aperçu : le message est valide, mais cette version de travail n’envoie rien.';
      return;
    }
    btn.disabled = true;
    status.textContent = 'Envoi en cours…';
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' } });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        successText.textContent = option()?.dataset.sent ?? successText.textContent;
        status.textContent = '';
        form.hidden = true;
        success.hidden = false;
        success.focus();
        return;
      }
      if (data.errors && Object.keys(data.errors).length) {
        show(data.errors);
        if (!summary.hidden) summary.focus();
      }
      status.textContent = data.message || 'L’envoi a échoué. Réessayez ou appelez le centre.';
    } catch {
      // The centre's own line, written by the server on its <option>.
      const tel = option()?.dataset.phone;
      status.textContent = tel ? `Connexion impossible. Appelez le centre au ${tel}.` : 'Connexion impossible. Appelez le centre de votre choix.';
    } finally {
      btn.disabled = false;
    }
  });

  // A link to the form section (/pneus/#contact) opens the dialog, the visitor picks the centre.
  if (window.location.hash === '#contact') open(null, null);
}
