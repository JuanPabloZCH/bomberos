/* ============================================================
   views/study.js — modo estudio con tarjetas y autoevaluación
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;

  const SCOPES = [
    { id: 'all', label: 'Banco completo' },
    { id: 'new', label: 'Sin responder' },
    { id: 'failed', label: 'Falladas' },
    { id: 'unmastered', label: 'No dominadas' }
  ];

  function StudyView() {
    let rootEl = null;
    let state = null;
    let areaEl = null;

    function buildDeck(focusId) {
      let ids = Bank.pool(state.scope);
      if (state.shuffle) ids = UI.shuffle(ids);
      if (focusId && ids.indexOf(focusId) !== -1) {
        ids = [focusId].concat(ids.filter((id) => id !== focusId));
      }
      state.deck = ids;
      state.index = 0;
      state.revealed = false;
      state.known = 0;
      state.unknown = 0;
    }

    function updateProgress() {
      const total = state.deck.length;
      const current = Math.min(state.index + 1, total);
      const pct = total ? Math.round((state.index / total) * 100) : 0;
      const text = rootEl.querySelector('[data-study-progress-text]');
      if (text) text.textContent = total ? 'Pregunta ' + current + ' de ' + total : 'Sin preguntas';
      const bar = rootEl.querySelector('[data-study-progress-bar]');
      if (bar) bar.style.width = pct + '%';
      const known = rootEl.querySelector('[data-study-known]');
      if (known) known.textContent = String(state.known);
      const unknown = rootEl.querySelector('[data-study-unknown]');
      if (unknown) unknown.textContent = String(state.unknown);
    }

    function optionsHTML(q, revealed) {
      return '<div class="options" aria-label="Alternativas">' +
        q.options.map((o) => {
          const isAnswer = o.letter === q.answer;
          return '<div class="option option--static' + (revealed && isAnswer ? ' is-correct' : '') + (revealed && !isAnswer ? ' is-dim' : '') + '">' +
            '<span class="option-letter" aria-hidden="true">' + o.letter + '</span>' +
            '<span class="option-text">' + UI.esc(o.text) + '</span>' +
            (revealed && isAnswer ? '<span class="option-mark">' + UI.icon('check') + '</span>' : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    function renderCard() {
      if (!areaEl) return;
      updateProgress();

      if (!state.deck.length) {
        areaEl.innerHTML = UI.emptyState({
          icon: 'graduation',
          title: 'No hay preguntas en este alcance',
          message: 'Cambia el filtro o vuelve al banco completo para comenzar a estudiar.',
          action: '<a class="btn btn-primary" href="#/banco">Abrir el banco</a>'
        });
        return;
      }

      if (state.index >= state.deck.length) {
        areaEl.innerHTML =
          '<div class="study-card">' +
            '<div class="study-complete">' +
              '<span class="big-icon">' + UI.icon('award') + '</span>' +
              '<h2>Repaso completado</h2>' +
              '<p class="muted">Terminaste esta ronda de ' + state.deck.length + ' preguntas. La autoevaluación queda registrada en tu progreso de estudio.</p>' +
              '<div class="study-summary">' +
                '<span>La sabía: <strong>' + state.known + '</strong></span>' +
                '<span>Por repasar: <strong>' + state.unknown + '</strong></span>' +
              '</div>' +
              '<div class="study-actions" style="max-width:520px;width:100%">' +
                '<button type="button" class="btn btn-primary" data-action="restart">' + UI.icon('rotate') + ' Otra ronda</button>' +
                '<a class="btn btn-ghost" href="#/practicar">' + UI.icon('target') + ' Practicar</a>' +
                '<a class="btn btn-outline" href="#/banco">' + UI.icon('book') + ' Volver al banco</a>' +
              '</div>' +
            '</div>' +
          '</div>';
        return;
      }

      const q = Bank.get(state.deck[state.index]);
      if (!q) { state.index += 1; renderCard(); return; }
      const status = Store.statusFor(q.id);
      const badge = status === 'mastered'
        ? '<span class="badge badge-mastered">' + UI.icon('check') + ' Dominada</span>'
        : status === 'learning'
          ? '<span class="badge badge-learning">En progreso</span>'
          : '<span class="badge badge-new">Nueva</span>';

      areaEl.innerHTML =
        '<article class="study-card">' +
          '<div class="q-head">' +
            '<span class="q-index"><strong>' + String(state.index + 1).padStart(2, '0') + '</strong> / ' + state.deck.length +
              '<span class="pill pill-muted" style="margin-left:6px">Ítem ' + q.number + '</span></span>' +
            badge +
          '</div>' +
          '<h2 class="q-text" tabindex="-1" id="study-question">' + UI.esc(q.text) + '</h2>' +
          optionsHTML(q, state.revealed) +
          '<div class="study-reveal">' +
            (state.revealed
              ? '<div class="study-answer" role="status" tabindex="-1">' +
                  '<div class="label">Clave del banco</div>' +
                  '<strong>' + q.answer + ') ' + UI.esc(Bank.answerText(q)) + '</strong>' +
                '</div>' +
                '<div class="study-actions">' +
                  '<button type="button" class="btn btn-primary" data-action="known">' + UI.icon('check') + ' La sabía</button>' +
                  '<button type="button" class="btn btn-danger" data-action="unknown">' + UI.icon('x') + ' No la sabía</button>' +
                '</div>' +
                '<p class="tiny muted" style="margin-top:10px">La autoevaluación no modifica tu precisión de examen; solo registra el repaso.</p>'
              : '<button type="button" class="btn btn-primary btn-lg btn-block" data-action="reveal">' + UI.icon('eye') + ' Mostrar respuesta</button>' +
                '<p class="tiny muted center" style="margin-top:10px">Atajo: <kbd>Espacio</kbd> para revelar</p>') +
          '</div>' +
        '</article>';
    }

    function advance(known) {
      const q = Bank.get(state.deck[state.index]);
      if (!q) return;
      Store.touchStudy(q.id, known);
      if (known) state.known += 1;
      else state.unknown += 1;
      state.index += 1;
      state.revealed = false;
      renderCard();
      updateProgress();
      const card = rootEl.querySelector('.study-card');
      if (card) {
        const heading = card.querySelector('#study-question');
        if (heading) heading.focus({ preventScroll: true });
      }
    }

    function restart() {
      buildDeck(null);
      renderCard();
      updateProgress();
      UI.announce('Nueva ronda de estudio iniciada.');
    }

    function onKeydown(event) {
      if (document.querySelector('.modal-backdrop')) return;
      const target = event.target;
      if (target && target.closest && target.closest('button, a, input, select, textarea')) return;
      if (!state.deck.length || state.index >= state.deck.length) return;
      if (event.key === ' ' || event.key === 'Enter') {
        if (!state.revealed) {
          event.preventDefault();
          state.revealed = true;
          renderCard();
          const answer = rootEl.querySelector('.study-answer');
          if (answer) answer.focus({ preventScroll: true });
        }
      } else if (state.revealed && (event.key === '1' || event.key === '2')) {
        event.preventDefault();
        advance(event.key === '1');
      }
    }

    function render(root, params) {
      rootEl = root;
      const focusId = params.get('q') ? Number(params.get('q')) : null;

      state = { scope: 'all', shuffle: true, deck: [], index: 0, revealed: false, known: 0, unknown: 0 };
      buildDeck(focusId && Bank.get(focusId) ? focusId : null);

      root.innerHTML =
        UI.pageHead({
          eyebrow: 'Estudio',
          title: 'Modo estudio',
          lead: 'Repasa las preguntas sin presión de tiempo. Intenta recordar la clave, revela la respuesta y marca si la sabías para llevar un registro de tu repaso.',
          actions: '<a class="btn btn-ghost btn-sm" href="#/banco">' + UI.icon('book') + ' Ir al banco</a>'
        }) +
        '<div class="study-shell">' +
          '<div class="study-progress-row">' +
            '<span data-study-progress-text>Pregunta 1</span>' +
            '<span><strong data-study-known>0</strong> sabidas · <strong data-study-unknown>0</strong> por repasar</span>' +
          '</div>' +
          '<div class="bar bar--thin"><i data-study-progress-bar style="width:0%"></i></div>' +
          '<div class="row" style="margin-top:16px;gap:10px">' +
            '<label class="sr-only" for="study-scope">Alcance del repaso</label>' +
            '<select class="select" id="study-scope" style="max-width:220px">' +
              SCOPES.map((s) => '<option value="' + s.id + '">' + s.label + ' · ' + (s.id === 'all' ? Bank.count() : Bank.counts()[s.id]) + '</option>').join('') +
            '</select>' +
            '<label class="row tiny muted" style="gap:8px;cursor:pointer">' +
              '<span class="switch"><input type="checkbox" id="study-shuffle" checked></span> Orden aleatorio' +
            '</label>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-action="restart" style="margin-left:auto">' + UI.icon('rotate') + ' Reiniciar</button>' +
          '</div>' +
          '<div data-study-area></div>' +
          '<div class="kbd-hint" style="justify-content:center;margin-top:18px">' +
            '<kbd>Espacio</kbd> revelar · <kbd>1</kbd> la sabía · <kbd>2</kbd> no la sabía' +
          '</div>' +
        '</div>';

      areaEl = root.querySelector('[data-study-area]');
      renderCard();
      updateProgress();

      root.querySelector('#study-scope').addEventListener('change', (event) => {
        state.scope = event.target.value;
        buildDeck(null);
        renderCard();
        updateProgress();
      });
      root.querySelector('#study-shuffle').addEventListener('change', (event) => {
        state.shuffle = event.target.checked;
        buildDeck(null);
        renderCard();
        updateProgress();
      });

      root.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]');
        if (!action) return;
        const name = action.dataset.action;
        if (name === 'reveal') {
          state.revealed = true;
          renderCard();
          const answer = root.querySelector('.study-answer');
          if (answer) {
            answer.setAttribute('tabindex', '-1');
            answer.focus({ preventScroll: true });
          }
        } else if (name === 'known') {
          advance(true);
        } else if (name === 'unknown') {
          advance(false);
        } else if (name === 'restart') {
          restart();
        }
      });

      document.addEventListener('keydown', onKeydown);

      if (focusId) {
        const card = root.querySelector('.study-card');
        if (card) window.setTimeout(() => card.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
      }
    }

    return {
      render,
      destroy() {
        document.removeEventListener('keydown', onKeydown);
        rootEl = null;
        areaEl = null;
        state = null;
      }
    };
  }

  window.StudyView = StudyView;
})();
