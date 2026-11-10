/* ============================================================
   views/library.js — banco completo de preguntas
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;
  const Router = window.Router;

  const SCOPES = [
    { id: 'all', label: 'Todas' },
    { id: 'new', label: 'Sin responder' },
    { id: 'failed', label: 'Falladas' },
    { id: 'unmastered', label: 'No dominadas' },
    { id: 'studied', label: 'Estudiadas' }
  ];

  const SORTS = [
    { id: 'number', label: 'N.º ascendente' },
    { id: 'number-desc', label: 'N.º descendente' },
    { id: 'weak', label: 'Más falladas' },
    { id: 'recent', label: 'Última práctica' }
  ];

  function LibraryView() {
    let rootEl = null;
    let state = null;
    let counts = null;
    let listEl = null;
    let focusId = null;

    function statusBadge(id) {
      const status = Store.statusFor(id);
      if (status === 'mastered') return '<span class="badge badge-mastered">' + UI.icon('check') + ' Dominada</span>';
      if (status === 'learning') return '<span class="badge badge-learning">En progreso</span>';
      return '<span class="badge badge-new">Nueva</span>';
    }

    function questionMeta(q) {
      const p = Store.progressFor(q.id);
      const attempts = p.attempts || 0;
      const accuracy = attempts ? Math.round((p.correct / attempts) * 100) : null;
      return {
        attempts,
        accuracy,
        failed: p.lastCorrect === false,
        lastAt: p.lastAt,
        studyKnown: p.studyKnown || 0,
        studyUnknown: p.studyUnknown || 0
      };
    }

    function itemHTML(q) {
      const meta = questionMeta(q);
      const open = state.open.has(q.id);
      const bodyId = 'bank-body-' + q.id;
      const highlight = (text) => UI.highlight(text, state.query);
      return '<article class="bank-item' + (open ? ' is-open' : '') + '" data-qid="' + q.id + '">' +
        '<button type="button" class="bank-q" data-action="toggle" aria-expanded="' + open + '" aria-controls="' + bodyId + '">' +
          '<span class="num">' + q.number + '</span>' +
          '<span class="q-body">' +
            '<span class="q-meta">' +
              statusBadge(q.id) +
              (meta.failed ? '<span class="badge badge-failed">Última fallada</span>' : '') +
              '<span class="q-page">PDF · pág. ' + (q.page || '—') + '</span>' +
            '</span>' +
            '<span class="q-title">' + highlight(q.text) + '</span>' +
          '</span>' +
          '<span class="chev" aria-hidden="true">' + UI.icon('chevron-down') + '</span>' +
        '</button>' +
        '<div class="bank-body" id="' + bodyId + '"' + (open ? '' : ' hidden') + '>' +
          '<div class="bank-options">' +
            q.options.map((o) =>
              '<div class="bank-opt' + (o.letter === q.answer ? ' is-answer' : '') + '">' +
                '<span class="letter">' + o.letter + '</span>' +
                '<span>' + highlight(o.text) + '</span>' +
                (o.letter === q.answer ? '<span class="tag">Clave</span>' : '') +
              '</div>'
            ).join('') +
          '</div>' +
          '<div class="bank-foot">' +
            '<div class="stats">' +
              (meta.attempts
                ? '<span>Intentos: <strong>' + meta.attempts + '</strong></span>' +
                  '<span>Precisión: <strong>' + meta.accuracy + '%</strong></span>' +
                  '<span>Última: <strong>' + UI.fmtDateShort(meta.lastAt) + '</strong></span>'
                : '<span>Sin intentos registrados</span>') +
              (meta.studyKnown || meta.studyUnknown
                ? '<span>Estudio: <strong>' + meta.studyKnown + '</strong> sabidas · <strong>' + meta.studyUnknown + '</strong> por repasar</span>'
                : '') +
            '</div>' +
            '<div class="bank-actions">' +
              '<button type="button" class="btn btn-sm btn-ghost" data-action="practice-one" data-id="' + q.id + '">' + UI.icon('target') + ' Practicar esta</button>' +
              '<a class="btn btn-sm btn-outline" href="#/estudiar?q=' + q.id + '">' + UI.icon('graduation') + ' Estudiar</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    function visibleQuestions() {
      return Bank.filtered({ query: state.query, scope: state.scope, sort: state.sort });
    }

    function renderList() {
      if (!listEl) return;
      const all = visibleQuestions();
      const visible = all.slice(0, state.pageSize);

      listEl.innerHTML = visible.length
        ? visible.map(itemHTML).join('')
        : UI.emptyState({
            icon: 'search',
            title: 'No encontramos preguntas',
            message: state.query
              ? 'Prueba con otra palabra o revisa los filtros de progreso.'
              : 'No hay preguntas con este filtro. Cambia el alcance para ver el banco completo.',
            action: '<button type="button" class="btn btn-ghost" data-action="clear-filters">Limpiar filtros</button>'
          });

      const countEl = rootEl.querySelector('[data-bank-count]');
      if (countEl) {
        countEl.innerHTML = 'Mostrando <strong>' + visible.length + '</strong> de <strong>' + all.length + '</strong> ' +
          UI.plural(all.length, 'pregunta', 'preguntas') + (state.query ? ' para «' + UI.esc(state.query) + '»' : '');
      }

      const more = rootEl.querySelector('[data-load-more]');
      if (more) {
        more.hidden = visible.length >= all.length;
        more.textContent = '';
        if (visible.length < all.length) {
          more.innerHTML = '<button type="button" class="btn btn-ghost" data-action="more">' +
            UI.icon('chevron-down') + ' Mostrar ' + Math.min(25, all.length - visible.length) + ' más</button>' +
            '<span class="tiny muted">' + (all.length - visible.length) + ' restantes</span>';
        }
      }
    }

    async function practiceOne(id) {
      if (Store.get().active) {
        const ok = await UI.confirm({
          title: 'Ya tienes una sesión en curso',
          message: 'Para practicar esta pregunta se descartará la sesión sin terminar.',
          confirmLabel: 'Descartar y practicar',
          danger: true
        });
        if (!ok) return;
      }
      const newSession = {
        id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        mode: 'practice',
        questionIds: [id],
        answers: {},
        flags: [],
        index: 0,
        startedAt: new Date().toISOString(),
        endsAt: null,
        timeLimitSec: 0,
        config: { count: 1, minutes: 0, scope: 'all', order: 'random' }
      };
      Store.startSession(newSession);
      Router.go('/sesion');
    }

    function bind() {
      listEl.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-action="toggle"]');
        if (toggle) {
          const item = toggle.closest('.bank-item');
          const id = Number(item.dataset.qid);
          const body = item.querySelector('.bank-body');
          const isOpen = state.open.has(id);
          if (isOpen) state.open.delete(id);
          else state.open.add(id);
          item.classList.toggle('is-open', !isOpen);
          toggle.setAttribute('aria-expanded', String(!isOpen));
          if (body) body.hidden = isOpen;
          return;
        }
        const more = event.target.closest('[data-action="more"]');
        if (more) {
          state.pageSize += 25;
          renderList();
          return;
        }
        const practice = event.target.closest('[data-action="practice-one"]');
        if (practice) {
          practiceOne(Number(practice.dataset.id));
          return;
        }
        const clear = event.target.closest('[data-action="clear-filters"]');
        if (clear) {
          state.query = '';
          state.scope = 'all';
          state.sort = 'number';
          state.pageSize = 25;
          const search = rootEl.querySelector('#bank-search');
          if (search) search.value = '';
          const sort = rootEl.querySelector('#bank-sort');
          if (sort) sort.value = 'number';
          rootEl.querySelectorAll('[data-scope]').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.dataset.scope === 'all'));
          });
          renderList();
        }
      });
    }

    function render(root, params) {
      rootEl = root;
      counts = Bank.counts();
      focusId = params.get('q') ? Number(params.get('q')) : null;
      const requestedScope = params.get('scope');
      const initialScope = SCOPES.some((scope) => scope.id === requestedScope) ? requestedScope : 'all';

      state = {
        query: '',
        scope: initialScope,
        sort: 'number',
        pageSize: 25,
        open: new Set()
      };

      if (focusId && Bank.get(focusId)) {
        const index = Bank.filtered({ sort: 'number' }).findIndex((q) => q.id === focusId);
        state.pageSize = Math.max(25, index + 1);
        state.open.add(focusId);
      }

      root.innerHTML =
        UI.pageHead({
          eyebrow: 'Banco de preguntas',
          title: 'Las 200 preguntas',
          lead: 'Consulta cada enunciado con sus cuatro alternativas y la clave original. La numeración, el orden de las opciones y la redacción se conservan tal como en el PDF.',
          actions: '<a class="btn btn-ghost btn-sm" href="#/estudiar">' + UI.icon('graduation') + ' Modo estudio</a>' +
            (counts.failed ? '<button type="button" class="btn btn-primary btn-sm" data-action="practice-failed">' + UI.icon('target') + ' Practicar falladas (' + counts.failed + ')</button>' : '')
        }) +
        '<div class="bank-toolbar">' +
          '<div class="search-field">' +
            UI.icon('search') +
            '<label class="sr-only" for="bank-search">Buscar en el banco de preguntas</label>' +
            '<input class="input" id="bank-search" type="search" placeholder="Buscar por texto, alternativa o número…" autocomplete="off">' +
          '</div>' +
          '<label class="sr-only" for="bank-sort">Ordenar preguntas</label>' +
          '<select class="select" id="bank-sort" style="max-width:210px">' +
            SORTS.map((s) => '<option value="' + s.id + '">' + s.label + '</option>').join('') +
          '</select>' +
          '<span class="bank-count" data-bank-count></span>' +
        '</div>' +
        '<div class="chip-row" style="margin-bottom:16px" role="group" aria-label="Filtrar por progreso">' +
          SCOPES.map((s) =>
            '<button type="button" class="chip" data-scope="' + s.id + '" aria-pressed="' + (s.id === state.scope) + '">' +
              s.label + ' · ' + (s.id === 'all' ? counts.all : counts[s.id]) +
            '</button>'
          ).join('') +
        '</div>' +
        '<div class="bank-list" data-bank-list></div>' +
        '<div class="load-more-wrap" data-load-more></div>';

      listEl = root.querySelector('[data-bank-list]');
      bind();
      renderList();

      const search = root.querySelector('#bank-search');
      const onSearch = UI.debounce(() => {
        state.query = search.value.trim();
        state.pageSize = 25;
        state.open.clear();
        renderList();
      }, 180);
      search.addEventListener('input', onSearch);

      root.querySelector('#bank-sort').addEventListener('change', (event) => {
        state.sort = event.target.value;
        state.pageSize = 25;
        renderList();
      });

      root.querySelectorAll('[data-scope]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.scope = btn.dataset.scope;
          state.pageSize = 25;
          state.open.clear();
          root.querySelectorAll('[data-scope]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          renderList();
        });
      });

      const failedBtn = root.querySelector('[data-action="practice-failed"]');
      if (failedBtn) {
        failedBtn.addEventListener('click', async () => {
          const ids = Bank.pool('failed');
          if (!ids.length) return;
          if (Store.get().active) {
            const ok = await UI.confirm({
              title: 'Ya tienes una sesión en curso',
              message: 'Para practicar las falladas se descartará la sesión sin terminar.',
              confirmLabel: 'Descartar y practicar',
              danger: true
            });
            if (!ok) return;
          }
          const shuffled = UI.shuffle(ids);
          Store.startSession({
            id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            mode: 'practice',
            questionIds: shuffled,
            answers: {},
            flags: [],
            index: 0,
            startedAt: new Date().toISOString(),
            endsAt: null,
            timeLimitSec: 0,
            config: { count: shuffled.length, minutes: 0, scope: 'failed', order: 'random' }
          });
          Router.go('/sesion');
        });
      }

      if (focusId) {
        const target = root.querySelector('[data-qid="' + focusId + '"]');
        if (target) {
          window.setTimeout(() => {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            const toggle = target.querySelector('[data-action="toggle"]');
            if (toggle) toggle.focus({ preventScroll: true });
          }, 120);
        }
      }
    }

    return {
      render,
      destroy() {
        rootEl = null;
        listEl = null;
        state = null;
      }
    };
  }

  window.LibraryView = LibraryView;
})();
