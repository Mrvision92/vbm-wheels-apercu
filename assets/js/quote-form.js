/**
 * Quote request form (/demande-de-devis/) — port of the <script> of src/components/forms/QuoteForm.astro.
 *
 * Progressive enhancement of app/views/forms/quote-form.php: the form works as one long classic
 * POST without this script. With it: three steps with a progress bar, prefill from the URL
 * (?service=…, ?centre=…, ?livraison=1; a service the form does not offer preselects nothing),
 * the « Finition » field shown for the complete repair only (its data-finish-for),
 * inline validation with an error summary, photo previews (drag and drop too), fetch()
 * submission with a JSON answer and the success panel. The messages repeat those of
 * app/form/handler.php.
 *
 * The anti-bot token is rendered by the server (form_token_field()): never overwrite it.
 * The limits below mirror config 'form.uploads' (app/config.example.php); the server checks them
 * again, and the messages below are built from them.
 * Preview build (<html data-preview>, tools/export-static.php): a valid form is not sent; a notice
 * says so instead.
 */

const PREVIEW = document.documentElement.hasAttribute('data-preview');
const MAX_FILES = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;

const form = document.querySelector('[data-quote-form]');
if (form) init(form);

/** @param {HTMLFormElement} form */
function init(form) {
  const steps = [...form.querySelectorAll('[data-step]')];
  const progress = form.querySelector('[data-progress]');
  const status = form.querySelector('[data-status]');
  const summary = form.querySelector('[data-summary]');
  const summaryList = form.querySelector('[data-summary-list]');
  const success = document.querySelector('[data-success]');
  const fileInput = form.querySelector('[data-photos]');
  const thumbs = form.querySelector('[data-thumbs]');
  const deliveryFields = form.querySelector('[data-delivery-fields]');
  const finishField = form.querySelector('[data-finish-for]');
  let current = 1;
  /** @type {File[]} */
  let files = [];

  form.noValidate = true;
  form.classList.add('is-enhanced');
  progress.hidden = false;
  form.querySelectorAll('[data-nav]').forEach((n) => (n.hidden = false));
  form.querySelector('.qf__nav--submit [data-prev]').hidden = false;

  // Prefill from the URL (?service=…, ?centre=…, ?livraison=1). Only a value that matches one of
  // the form's own choices is applied.
  const choose = (name, value) => {
    if (!value) return;
    [...form.querySelectorAll(`input[type="radio"][name="${name}"]`)].find((r) => r.value === value)?.click();
  };
  const params = new URLSearchParams(location.search);
  choose('service', params.get('service'));
  choose('centre', params.get('livraison') ? 'livraison' : params.get('centre'));

  const toggleDelivery = () => {
    const on = form.querySelector('input[name="centre"]:checked')?.value === 'livraison';
    deliveryFields.classList.toggle('is-open', on);
    deliveryFields.querySelector('textarea').toggleAttribute('required', on);
  };
  form.querySelectorAll('input[name="centre"]').forEach((r) => r.addEventListener('change', toggleDelivery));
  toggleDelivery();

  // Only the complete repair asks for a finish: leaving it clears the choice, so none is sent.
  const needsFinish = () => form.querySelector('input[name="service"]:checked')?.value === finishField.dataset.finishFor;
  const toggleFinish = () => {
    const on = needsFinish();
    finishField.classList.toggle('is-open', on);
    if (!on) {
      finishField.querySelectorAll('input:checked').forEach((r) => (r.checked = false));
      clearField(finishField);
    }
  };
  form.querySelectorAll('input[name="service"]').forEach((r) => r.addEventListener('change', toggleFinish));

  const show = (n, focus = true) => {
    current = n;
    steps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === n));
    progress.querySelectorAll('[data-progress-step]').forEach((p) => {
      const k = Number(p.dataset.progressStep);
      if (k === n) p.setAttribute('aria-current', 'step');
      else p.removeAttribute('aria-current');
      p.classList.toggle('is-done', k < n);
    });
    if (focus) {
      const legend = steps[n - 1].querySelector('legend');
      legend?.setAttribute('tabindex', '-1');
      legend?.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };
  show(1, false);

  // ─── Validation ────────────────────────────────────────────────
  const val = (name) => {
    const el = form.elements.namedItem(name);
    if (el instanceof RadioNodeList) return el.value;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked ? el.value : '';
    return el && 'value' in el ? String(el.value).trim() : '';
  };

  /** @returns {Record<string, string>} field → message */
  const validateStep = (n) => {
    const e = {};
    if (n === 1) {
      if (!val('service')) e.service = 'Choisissez le type d’intervention.';
      if (needsFinish() && !val('finition')) e.finition = 'Choisissez la finition.';
      if (!val('wheels')) e.wheels = 'Indiquez le nombre de jantes.';
    }
    if (n === 2) {
      const err = checkFiles(files);
      if (err) e.photos = err;
    }
    if (n === 3) {
      if (val('name').length < 2) e.name = 'Indiquez votre nom.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) e.email = 'Indiquez une adresse e-mail valide, par exemple nom@exemple.be.';
      if (val('phone') && !/^[0-9 +().\/-]{6,30}$/.test(val('phone'))) e.phone = 'Le numéro de téléphone ne semble pas valide.';
      if (!val('centre')) e.centre = 'Choisissez un centre ou l’enlèvement.';
      if (val('centre') === 'livraison' && val('address').length < 8) e.address = 'Indiquez l’adresse d’enlèvement (rue, numéro, code postal, localité).';
      if (!val('consent')) e.consent = 'Votre accord est nécessaire pour que nous puissions traiter votre demande.';
    }
    return e;
  };

  const clearField = (field) => {
    field.classList.remove('has-error');
    field.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    const msg = field.querySelector('[data-error]');
    if (msg) msg.textContent = '';
  };
  toggleFinish(); // after the prefill above, once clearField exists

  const clearErrors = () => {
    form.querySelectorAll('[data-field]').forEach(clearField);
    summary.hidden = true;
    summaryList.replaceChildren();
  };

  const firstControl = (key) => form.querySelector(`[data-field="${key}"] input, [data-field="${key}"] select, [data-field="${key}"] textarea`);

  const showErrors = (errors, withSummary) => {
    clearErrors();
    const keys = Object.keys(errors);
    keys.forEach((k) => {
      const field = form.querySelector(`[data-field="${k}"]`);
      if (!field) return;
      field.classList.add('has-error');
      const msg = field.querySelector('[data-error]');
      if (msg) msg.textContent = errors[k];
      field.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="radiogroup"]').forEach((i) => i.setAttribute('aria-invalid', 'true'));
    });
    if (withSummary && keys.length) {
      keys.forEach((k) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#err-${k}`;
        a.textContent = errors[k];
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const target = firstControl(k);
          const step = target?.closest('[data-step]');
          if (step) show(Number(step.dataset.step), false);
          target?.focus();
        });
        li.append(a);
        summaryList.append(li);
      });
      summary.hidden = false;
      summary.focus();
    } else if (keys.length) {
      firstControl(keys[0])?.focus();
    }
  };

  // Step holding the first error: 1 (the rim), 2 (photos) or 3 (contact details).
  const stepOf = (errors) => (errors.service || errors.finition || errors.wheels || errors.size || errors.message ? 1 : errors.photos ? 2 : 3);

  // Clear a field's error as soon as it is corrected.
  form.addEventListener('input', (ev) => {
    const field = ev.target.closest('[data-field]');
    if (field?.classList.contains('has-error')) clearField(field);
  });

  form.querySelectorAll('[data-next]').forEach((b) =>
    b.addEventListener('click', () => {
      const errors = validateStep(current);
      if (Object.keys(errors).length) return showErrors(errors, false);
      clearErrors();
      show(Math.min(steps.length, current + 1));
    }),
  );
  form.querySelectorAll('[data-prev]').forEach((b) => b.addEventListener('click', () => show(Math.max(1, current - 1))));

  // ─── Photos ────────────────────────────────────────────────────
  function checkFiles(list) {
    if (list.length > MAX_FILES) return `Maximum ${MAX_FILES} photos.`;
    let total = 0;
    for (const f of list) {
      const okType = ACCEPTED.test(f.type) || /\.(heic|heif)$/i.test(f.name);
      if (!okType) return `« ${f.name} » : formats acceptés JPEG, PNG, WebP ou HEIC.`;
      if (f.size > MAX_BYTES) return `« ${f.name} » dépasse ${MAX_BYTES / 1048576} Mo.`;
      total += f.size;
    }
    if (total > MAX_TOTAL) return `L’ensemble des photos dépasse ${MAX_TOTAL / 1048576} Mo.`;
    return '';
  }

  // The file input always holds the accepted list, so a classic FormData carries every photo.
  const syncInput = () => {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInput.files = dt.files;
  };

  const sizeLabel = (bytes) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1048576).toFixed(1)} Mo`);

  const renderThumbs = () => {
    thumbs.replaceChildren();
    files.forEach((f, i) => {
      const li = document.createElement('li');
      li.className = 'qf__thumb';
      // HEIC cannot be previewed by most browsers: a labelled placeholder stands in for it.
      if (/^image\/(jpeg|png|webp)$/.test(f.type)) {
        const img = document.createElement('img');
        const url = URL.createObjectURL(f);
        img.alt = '';
        img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        img.src = url;
        li.append(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'qf__thumb-ph';
        ph.textContent = 'HEIC';
        li.append(ph);
      }
      const name = document.createElement('span');
      name.className = 'qf__thumb-name';
      name.textContent = `${f.name} · ${sizeLabel(f.size)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'qf__thumb-remove';
      const hidden = document.createElement('span');
      hidden.className = 'visually-hidden';
      hidden.textContent = `Retirer ${f.name}`;
      remove.append(hidden, '×');
      remove.addEventListener('click', () => {
        files.splice(i, 1);
        syncInput();
        renderThumbs();
        status.textContent = `${f.name} retirée.`;
      });
      li.append(name, remove);
      thumbs.append(li);
    });
  };

  const addFiles = (incoming) => {
    const next = [...files];
    for (const f of incoming) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    const err = checkFiles(next);
    if (err) {
      showErrors({ photos: err }, false);
      syncInput();
      return;
    }
    files = next;
    syncInput();
    renderThumbs();
  };

  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles([...fileInput.files].filter((f) => !files.includes(f)));
  });
  const drop = form.querySelector('[data-drop]');
  ['dragenter', 'dragover'].forEach((t) =>
    drop.addEventListener(t, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    }),
  );
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  });

  // ─── Submit ────────────────────────────────────────────────────
  const submitBtn = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const all = { ...validateStep(1), ...validateStep(2), ...validateStep(3) };
    if (Object.keys(all).length) {
      show(stepOf(all), false);
      return showErrors(all, true);
    }
    clearErrors();
    if (PREVIEW) {
      status.textContent = 'Aperçu : la demande est valide, mais cette version de travail n’envoie rien.';
      return;
    }
    submitBtn.disabled = true;
    submitLabel.textContent = 'Envoi en cours…';
    status.textContent = 'Envoi de votre demande en cours.';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json', 'X-Requested-With': 'fetch' },
      });
      const data = await res.json().catch(() => ({ ok: false, message: '' }));
      if (res.ok && data.ok) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        success.scrollIntoView({ block: 'start' });
        return;
      }
      if (data.errors && Object.keys(data.errors).length) {
        show(stepOf(data.errors), false);
        showErrors(data.errors, true);
      }
      status.textContent = data.message || 'L’envoi a échoué. Réessayez ou appelez-nous.';
    } catch {
      // The centres' lines, as the call picker of the page lists them (partials/call-picker.php).
      const lines = [...document.querySelectorAll('[data-call-line]')].map((a) => a.dataset.callLine).join(', ');
      status.textContent = `Connexion impossible. Vérifiez votre connexion internet ou appelez l’un de nos centres${lines ? `\u00a0: ${lines}` : ''}.`;
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Envoyer ma demande';
    }
  });
}
