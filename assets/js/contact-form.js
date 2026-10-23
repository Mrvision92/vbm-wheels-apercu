/**
 * Contact form (/contact/) — port of the <script> of src/components/forms/ContactForm.astro.
 *
 * Progressive enhancement of app/views/forms/contact-form.php (a classic POST without this
 * script): inline validation, fetch() submission with a JSON answer, then the success panel.
 * The anti-bot token is rendered by the server (form_token_field()): never overwrite it.
 * Preview build (<html data-preview>, tools/export-static.php): a valid form is not sent; a notice
 * says so instead.
 */

const PREVIEW = document.documentElement.hasAttribute('data-preview');
const form = document.querySelector('[data-contact-form]');
if (form) {
  form.noValidate = true;
  const status = form.querySelector('[data-status]');
  const btn = form.querySelector('[data-submit]');
  const success = document.querySelector('[data-contact-success]');

  const v = (n) => {
    const el = form.elements.namedItem(n);
    return el ? (el.type === 'checkbox' ? (el.checked ? 'oui' : '') : el.value.trim()) : '';
  };

  /** Shows the given errors (field → message) and clears the others; focuses the first one. */
  const show = (errors) => {
    form.querySelectorAll('[data-field]').forEach((f) => {
      const k = f.dataset.field;
      const msg = f.querySelector('[data-error]');
      const input = f.querySelector('input, textarea, select');
      if (errors[k]) {
        f.classList.add('has-error');
        input?.setAttribute('aria-invalid', 'true');
        if (msg) msg.textContent = errors[k];
      } else {
        f.classList.remove('has-error');
        input?.removeAttribute('aria-invalid');
        if (msg) msg.textContent = '';
      }
    });
    const first = Object.keys(errors)[0];
    if (first) form.querySelector(`[data-field="${first}"] input, [data-field="${first}"] textarea`)?.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = {};
    if (v('name').length < 2) errors.name = 'Indiquez votre nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) errors.email = 'Indiquez une adresse e-mail valide.';
    if (v('phone') && !/^[0-9 +().\/-]{6,30}$/.test(v('phone'))) errors.phone = 'Le numéro de téléphone ne semble pas valide.';
    if (v('message').length < 10) errors.message = 'Écrivez votre message (au moins quelques mots).';
    if (!v('consent')) errors.consent = 'Votre accord est nécessaire pour que nous puissions vous répondre.';
    show(errors);
    if (Object.keys(errors).length) return;
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
        form.hidden = true;
        success.hidden = false;
        success.focus();
        return;
      }
      if (data.errors) show(data.errors);
      status.textContent = data.message || 'L’envoi a échoué. Réessayez ou appelez-nous.';
    } catch {
      // The main number printed in the footer (app/data/site.php); the literal is only a fallback.
      const tel = document.querySelector('.footer__contact a[href^="tel:"]')?.textContent ?? '02 523 20 02';
      status.textContent = `Connexion impossible. Appelez-nous au ${tel}.`;
    } finally {
      btn.disabled = false;
    }
  });
}
