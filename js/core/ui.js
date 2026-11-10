/* ============================================================
   ui.js — utilidades de interfaz compartidas
   ============================================================ */
(function () {
  'use strict';

  const UI = {};

  /* ---------- Texto seguro ---------- */
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  UI.esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
  };

  UI.norm = function (value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /* ---------- Iconos ---------- */
  UI.icon = function (name, extraClass) {
    return '<svg class="icon' + (extraClass ? ' ' + extraClass : '') +
      '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  };

  /* ---------- Formatos ---------- */
  const pad = (n) => String(n).padStart(2, '0');

  UI.fmtClock = function (totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec);
  };

  UI.fmtDuration = function (totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    if (m < 60) return m + ' min' + (sec ? ' ' + sec + ' s' : '');
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h + ' h' + (mm ? ' ' + mm + ' min' : '');
  };

  UI.fmtDate = function (iso, opts) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PE', opts || {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  UI.fmtDateShort = function (iso) {
    return UI.fmtDate(iso, { day: '2-digit', month: 'short' });
  };

  UI.dateKey = function (date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  UI.fmtPct = function (value, decimals) {
    const n = Number(value) || 0;
    return (decimals ? n.toFixed(decimals) : Math.round(n)) + '%';
  };

  UI.score20 = function (correct, total) {
    if (!total) return 0;
    return Math.round((correct / total) * 20 * 10) / 10;
  };

  UI.plural = function (n, singular, plural) {
    return n === 1 ? singular : (plural || singular + 's');
  };

  UI.clamp = function (n, min, max) {
    return Math.min(max, Math.max(min, n));
  };

  UI.shuffle = function (list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  };

  UI.debounce = function (fn, wait) {
    let timer = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(ctx, args), wait);
    };
  };

  UI.highlight = function (text, query) {
    const raw = String(text == null ? '' : text);
    const safe = UI.esc(raw);
    const needle = UI.norm(query || '');
    if (!needle) return safe;

    const words = needle.split(' ').filter(Boolean)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) return safe;

    // Se localiza sobre una copia sin tildes que conserva la correspondencia
    // de índices con el texto original. Luego se escapa cada fragmento al construir el HTML.
    let stripped = '';
    const map = [];
    for (let i = 0; i < raw.length; i++) {
      stripped += raw[i].normalize('NFD')[0];
      map.push(i);
    }

    const regex = new RegExp('(' + words.join('|') + ')', 'gi');
    let result = '';
    let last = 0;
    let match;
    while ((match = regex.exec(stripped)) !== null) {
      if (!match[0].length) { regex.lastIndex += 1; continue; }
      const start = map[match.index];
      const end = map[match.index + match[0].length - 1] + 1;
      if (start < last) continue;
      result += UI.esc(raw.slice(last, start)) + '<mark>' + UI.esc(raw.slice(start, end)) + '</mark>';
      last = end;
    }
    result += UI.esc(raw.slice(last));
    return result;
  };

  /* ---------- Anuncios accesibles ---------- */
  let liveRegion = null;
  UI.announce = function (message) {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'live-region';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = '';
    window.setTimeout(() => { liveRegion.textContent = message; }, 30);
  };

  /* ---------- Toasts ---------- */
  UI.toast = function (message, type, ms) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const tone = type || 'info';
    const iconName = tone === 'ok' ? 'check-circle' : tone === 'bad' ? 'alert' : 'info';
    const el = document.createElement('div');
    el.className = 'toast toast--' + tone;
    el.setAttribute('role', 'status');
    el.innerHTML = UI.icon(iconName) + '<span>' + UI.esc(message) + '</span>';
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstElementChild);
    window.setTimeout(() => {
      el.classList.add('is-leaving');
      window.setTimeout(() => el.remove(), 220);
    }, ms || 3400);
  };

  /* ---------- Modal ---------- */
  let modalOpen = false;

  UI.openModal = function (options) {
    const opts = options || {};
    const root = document.getElementById('modal-root');
    const previousFocus = document.activeElement;
    const titleId = 'modal-title';
    const descId = 'modal-desc';

    const actions = (opts.actions || []).map((action, index) => {
      const kind = action.kind === 'primary' ? 'btn-primary'
        : action.kind === 'danger' ? 'btn-danger'
        : action.kind === 'outline' ? 'btn-outline' : 'btn-ghost';
      return '<button type="button" class="btn ' + kind + '" data-action-index="' + index + '">' +
        (action.icon ? UI.icon(action.icon) : '') + UI.esc(action.label) + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
        '<div class="modal-shell">' +
          '<div class="modal' + (opts.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '"' +
            (opts.description ? ' aria-describedby="' + descId + '"' : '') + '>' +
            '<button type="button" class="modal-close" data-modal-close aria-label="Cerrar">' + UI.icon('x') + '</button>' +
            '<h2 id="' + titleId + '">' + UI.esc(opts.title || '') + '</h2>' +
            (opts.description ? '<p id="' + descId + '">' + UI.esc(opts.description) + '</p>' : '') +
            '<div class="modal-body">' + (opts.body || '') + '</div>' +
            '<div class="modal-actions">' + actions + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const backdrop = root.querySelector('[data-modal-backdrop]');
    const dialog = root.querySelector('.modal');
    modalOpen = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return new Promise((resolve) => {
      let settled = false;

      function finish(value) {
        if (settled) return;
        settled = true;
        modalOpen = false;
        document.removeEventListener('keydown', onKeydown, true);
        document.body.style.overflow = previousOverflow;
        root.innerHTML = '';
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus({ preventScroll: true });
        }
        resolve(value);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusables = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }

      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop && opts.dismissible !== false) finish(null);
      });
      dialog.querySelector('[data-modal-close]').addEventListener('click', () => finish(null));
      dialog.querySelectorAll('[data-action-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = opts.actions[Number(btn.dataset.actionIndex)];
          if (action && typeof action.onClick === 'function') {
            const result = action.onClick(dialog, finish);
            if (result !== false && !action.keepOpen) finish(action.value != null ? action.value : action.label);
          } else {
            finish(action && action.value != null ? action.value : (action ? action.label : null));
          }
        });
      });
      document.addEventListener('keydown', onKeydown, true);
      if (typeof opts.onMount === 'function') opts.onMount(dialog);
      const focusTarget = dialog.querySelector('[data-autofocus]') ||
        dialog.querySelector('.modal-actions .btn-primary') ||
        dialog.querySelector('.modal-close');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  };

  UI.confirm = function (options) {
    const opts = options || {};
    return UI.openModal({
      title: opts.title || '¿Confirmar acción?',
      description: opts.message || '',
      body: opts.body || '',
      dismissible: opts.dismissible !== false,
      actions: [
        { label: opts.cancelLabel || 'Cancelar', kind: 'ghost', value: false },
        { label: opts.confirmLabel || 'Confirmar', kind: opts.danger ? 'danger' : 'primary', value: true }
      ]
    }).then((value) => value === true);
  };

  UI.closeModal = function () {
    if (!modalOpen) return;
    const close = document.querySelector('[data-modal-close]');
    if (close) close.click();
  };

  /* ---------- Anillo de progreso ---------- */
  let gaugeSeq = 0;
  UI.gauge = function (percent, size, stroke) {
    const s = size || 190;
    const w = stroke || 11;
    const pct = UI.clamp(Number(percent) || 0, 0, 100);
    const r = (s - w) / 2;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - pct / 100);
    const id = 'gauge-grad-' + (++gaugeSeq);
    return '<svg viewBox="0 0 ' + s + ' ' + s + '" role="img" aria-label="' + Math.round(pct) + '% de avance">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#ff6a3d"></stop>' +
        '<stop offset="100%" stop-color="#e5372a"></stop>' +
      '</linearGradient></defs>' +
      '<circle class="gauge-track" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '"></circle>' +
      '<circle class="gauge-fill" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" ' +
        'style="stroke:url(#' + id + ');stroke-dasharray:' + c.toFixed(2) + ';stroke-dashoffset:' + offset.toFixed(2) + '"></circle>' +
    '</svg>';
  };

  /* ---------- Cabecera de página ---------- */
  UI.pageHead = function (options) {
    return '<header class="page-head">' +
      '<div>' +
        (options.eyebrow ? '<span class="eyebrow">' + UI.esc(options.eyebrow) + '</span>' : '') +
        '<h1>' + UI.esc(options.title) + '</h1>' +
        (options.lead ? '<p class="lead">' + UI.esc(options.lead) + '</p>' : '') +
      '</div>' +
      (options.actions ? '<div class="row">' + options.actions + '</div>' : '') +
    '</header>';
  };

  /* ---------- Estado vacío ---------- */
  UI.emptyState = function (options) {
    return '<div class="empty-state">' +
      '<span class="empty-icon">' + UI.icon(options.icon || 'info') + '</span>' +
      '<h3>' + UI.esc(options.title || 'Sin datos') + '</h3>' +
      '<p>' + UI.esc(options.message || '') + '</p>' +
      (options.action ? options.action : '') +
    '</div>';
  };

  /* ---------- Progreso de respuestas ---------- */
  UI.accuracyTone = function (value) {
    if (value >= 75) return 'ok';
    if (value >= 50) return 'warn';
    return 'bad';
  };

  UI.optionHTML = function (question, option, state) {
    const cls = ['option'];
    if (state.selected) cls.push('is-selected');
    if (state.correct) cls.push('is-correct');
    if (state.wrong) cls.push('is-wrong');
    if (state.dim) cls.push('is-dim');
    if (state.locked) cls.push('is-locked');
    const mark = state.correct ? UI.icon('check') : state.wrong ? UI.icon('x') : '';
    return '<label class="' + cls.join(' ') + '">' +
      '<input type="radio" name="answer" value="' + option.letter + '"' +
        (state.selected ? ' checked' : '') + (state.locked ? ' disabled' : '') + '>' +
      '<span class="option-letter" aria-hidden="true">' + option.letter + '</span>' +
      '<span class="option-text">' + UI.esc(option.text) + '</span>' +
      '<span class="option-mark" aria-hidden="true">' + mark + '</span>' +
    '</label>';
  };

  UI.initials = function (text) {
    return String(text || '').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  };

  window.UI = UI;
})();
