/* ============================================================
   views/results.js — resultados y revisión de una sesión
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;
  const Router = window.Router;

  function ResultsView() {
    let rootEl = null;
    let session = null;
    let filter = 'all';

    function checkOf(id) {
      if (session.checks && session.checks[id]) return session.checks[id];
      const choice = session.answers ? session.answers[id] : null;
      if (!choice) return 'blank';
      const q = Bank.get(id);
      return q && choice === q.answer ? 'correct' : 'wrong';
    }

    function filteredIds() {
      return session.questionIds.filter((id) => {
        const check = checkOf(id);
        if (filter === 'wrong') return check === 'wrong';
        if (filter === 'blank') return check === 'blank';
        if (filter === 'right') return check === 'correct';
        if (filter === 'flagged') return (session.flags || []).indexOf(id) !== -1;
        return true;
      });
    }

    function filterCounts() {
      const counts = { all: session.questionIds.length, wrong: 0, blank: 0, right: 0, flagged: (session.flags || []).length };
      session.questionIds.forEach((id) => {
        const check = checkOf(id);
        if (check === 'wrong') counts.wrong += 1;
        else if (check === 'blank') counts.blank += 1;
        else counts.right += 1;
      });
      return counts;
    }

    function reviewCard(id, position) {
      const q = Bank.get(id);
      if (!q) return '';
      const choice = session.answers ? session.answers[id] : null;
      const check = checkOf(id);
      const flagged = (session.flags || []).indexOf(id) !== -1;
      const badge = check === 'correct'
        ? '<span class="badge badge-ok">' + UI.icon('check') + ' Correcta</span>'
        : check === 'blank'
          ? '<span class="badge badge-neutral">' + UI.icon('info') + ' En blanco</span>'
          : '<span class="badge badge-bad">' + UI.icon('x') + ' Incorrecta</span>';

      return '<article class="review-card is-' + (check === 'correct' ? 'right' : check === 'blank' ? 'blank' : 'wrong') + '">' +
        '<div class="review-head">' +
          '<span class="review-num">' + String(position).padStart(2, '0') + '</span>' +
          '<span class="pill pill-muted">Ítem ' + q.number + '</span>' +
          badge +
          (flagged ? '<span class="badge badge-learning">' + UI.icon('flag') + ' Marcada</span>' : '') +
        '</div>' +
        '<h3 class="review-q">' + UI.esc(q.text) + '</h3>' +
        '<div class="review-opts">' +
          q.options.map((o) => {
            const isAnswer = o.letter === q.answer;
            const isPickedWrong = choice === o.letter && !isAnswer;
            return '<div class="review-opt' + (isAnswer ? ' is-answer' : '') + (isPickedWrong ? ' is-picked-wrong' : '') + '">' +
              '<span class="letter">' + o.letter + '</span>' +
              '<span>' + UI.esc(o.text) + '</span>' +
              (isAnswer ? '<span class="tag">Clave</span>' : isPickedWrong ? '<span class="tag">Tu respuesta</span>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="review-foot">' +
          '<span>Tu respuesta: <strong>' + (choice ? UI.esc(choice) : 'sin responder') + '</strong></span>' +
          '<span>Clave del banco: <strong>' + q.answer + '</strong></span>' +
          '<span>PDF: pág. ' + (q.page || '—') + '</span>' +
        '</div>' +
      '</article>';
    }

    function renderReview() {
      const list = rootEl.querySelector('[data-review-list]');
      if (!list) return;
      const ids = filteredIds();
      list.innerHTML = ids.length
        ? ids.map((id) => reviewCard(id, session.questionIds.indexOf(id) + 1)).join('')
        : UI.emptyState({
            icon: 'filter',
            title: 'No hay preguntas en este filtro',
            message: 'Prueba con otro filtro para revisar la sesión completa.'
          });

      rootEl.querySelectorAll('[data-review-filter]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.reviewFilter === filter));
      });
    }

    async function launch(ids, mode, minutes, scope) {
      if (!ids.length) return;
      if (Store.get().active) {
        const ok = await UI.confirm({
          title: 'Ya tienes una sesión en curso',
          message: 'Para comenzar esta nueva sesión se descartará la que está sin terminar.',
          confirmLabel: 'Descartar y comenzar',
          danger: true
        });
        if (!ok) return;
      }
      const ordered = UI.shuffle(ids);
      const sessionNew = {
        id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        mode,
        questionIds: ordered,
        answers: {},
        flags: [],
        index: 0,
        startedAt: new Date().toISOString(),
        endsAt: minutes > 0 ? Date.now() + minutes * 60000 : null,
        timeLimitSec: minutes > 0 ? minutes * 60 : 0,
        config: { count: ordered.length, minutes, scope: scope || 'all', order: 'random' }
      };
      Store.startSession(sessionNew);
      Router.go('/sesion');
    }

    function render(root, params) {
      rootEl = root;
      const id = params.get('id');
      session = id ? Store.sessionById(id) : Store.lastSession();

      if (!session) {
        root.innerHTML = UI.pageHead({ eyebrow: 'Resultados', title: 'Todavía no hay resultados' }) +
          UI.emptyState({
            icon: 'chart',
            title: 'Completa una práctica o un simulacro',
            message: 'Cuando termines una sesión verás aquí tu calificación, el detalle de aciertos y la revisión de cada pregunta con la clave del banco.',
            action: '<a class="btn btn-primary" href="#/simulacro">Iniciar un simulacro</a>'
          });
        return;
      }

      const counts = filterCounts();
      const totalQ = (session.questionIds || []).length;
      const score20 = Number(session.score20) || 0;
      const correctCount = Number(session.correct) || 0;
      const wrongCount = Number(session.wrong) || 0;
      const blankCount = Number(session.blank) || 0;
      const answeredTotal = Number.isFinite(Number(session.answered))
        ? Number(session.answered)
        : correctCount + wrongCount;
      const durationSec = Number(session.durationSec) || 0;
      const percent = totalQ ? Math.round((correctCount / totalQ) * 100) : 0;
      const passScore = session.passScore != null ? Number(session.passScore) : Store.settings().passScore;
      const passed = score20 >= passScore;
      const modeLabel = session.mode === 'exam' ? 'Simulacro' : 'Práctica';
      const dateLabel = UI.fmtDate(session.finishedAt);
      const wrongIds = session.questionIds.filter((qid) => checkOf(qid) === 'wrong');
      const blankIds = session.questionIds.filter((qid) => checkOf(qid) === 'blank');
      const retryIds = wrongIds.concat(blankIds);
      const minutes = session.timeLimitSec ? Math.round(session.timeLimitSec / 60) : 0;
      const pace = answeredTotal ? Math.round(durationSec / answeredTotal) : 0;

      const title = passed ? 'Objetivo alcanzado' : (score20 >= passScore - 2 ? 'Cerca del objetivo' : 'A seguir entrenando');
      const message = passed
        ? 'Superaste la nota mínima de referencia. Revisa igualmente cada respuesta para consolidar la clave.'
        : 'Revisa las preguntas falladas y vuelve a intentarlo. La práctica repetida sobre los mismos ítems es la forma más rápida de subir.';

      root.innerHTML =
        '<div style="padding-top:28px">' +
          '<div class="result-hero">' +
            '<div class="gauge" aria-hidden="true">' +
              UI.gauge(percent) +
              '<div class="gauge-center">' +
                '<span class="gauge-pct">' + percent + '%</span>' +
                '<span class="gauge-label">Aciertos</span>' +
              '</div>' +
            '</div>' +
            '<div class="result-copy">' +
              '<span class="eyebrow">' + modeLabel + ' · ' + UI.esc(dateLabel) + '</span>' +
              '<h1>' + title + '</h1>' +
              '<p>' + UI.esc(message) + '</p>' +
              '<div class="result-score-row">' +
                '<div class="grade-box"><span>Nota</span><strong>' + score20.toFixed(1) + '</strong><span>/ 20</span></div>' +
                '<span class="pill ' + (passed ? 'pill-green' : 'pill-red') + '">' +
                  UI.icon(passed ? 'check-circle' : 'alert') + ' ' +
                  (passed ? 'Supera la referencia' : 'Bajo la referencia') + ' (' + passScore.toFixed(1) + ')' +
                '</span>' +
                '<span class="pill pill-muted">' + UI.icon('clock') + ' ' + UI.fmtDuration(durationSec) + '</span>' +
              '</div>' +
              '<div class="result-actions">' +
                '<button type="button" class="btn btn-primary" data-action="retry">' + UI.icon('rotate') + ' Repetir estas preguntas</button>' +
                (retryIds.length
                  ? '<button type="button" class="btn btn-ghost" data-action="practice-failed">' + UI.icon('target') + ' Practicar falladas (' + retryIds.length + ')</button>'
                  : '') +
                '<button type="button" class="btn btn-ghost" data-action="print">' + UI.icon('printer') + ' Imprimir</button>' +
                '<a class="btn btn-outline" href="#/inicio">Volver al inicio</a>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="result-metrics">' +
            '<div class="metric metric--ok"><div class="metric-label">Correctas</div><div class="metric-value">' + correctCount + '</div></div>' +
            '<div class="metric metric--bad"><div class="metric-label">Incorrectas</div><div class="metric-value">' + wrongCount + '</div></div>' +
            '<div class="metric metric--muted"><div class="metric-label">En blanco</div><div class="metric-value">' + blankCount + '</div></div>' +
            '<div class="metric"><div class="metric-label">Tiempo total</div><div class="metric-value">' + UI.fmtClock(durationSec) + '</div></div>' +
            '<div class="metric"><div class="metric-label">Ritmo</div><div class="metric-value">' + pace + '<small> s/pregunta</small></div></div>' +
          '</div>' +

          '<p class="tiny muted" style="margin-top:12px">La nota vigesimal se calcula sobre el total de preguntas de la sesión; las preguntas en blanco no suman aciertos. La referencia de ' + passScore.toFixed(1) + ' proviene del ítem 2 del banco y puede ajustarse en Ajustes.</p>' +

          '<section class="section" style="margin-top:38px">' +
            '<div class="section-head">' +
              '<div><h2>Revisión pregunta por pregunta</h2><p>Se muestra la clave original del banco y la alternativa que elegiste.</p></div>' +
              '<a class="section-link" href="#/banco">Abrir banco completo ' + UI.icon('arrow-right') + '</a>' +
            '</div>' +
            '<div class="review-toolbar">' +
              '<div class="chip-row" role="group" aria-label="Filtrar revisión">' +
                '<button type="button" class="chip" data-review-filter="all" aria-pressed="true">Todas · ' + counts.all + '</button>' +
                '<button type="button" class="chip" data-review-filter="wrong" aria-pressed="false">Incorrectas · ' + counts.wrong + '</button>' +
                '<button type="button" class="chip" data-review-filter="blank" aria-pressed="false">En blanco · ' + counts.blank + '</button>' +
                '<button type="button" class="chip" data-review-filter="right" aria-pressed="false">Correctas · ' + counts.right + '</button>' +
                (counts.flagged ? '<button type="button" class="chip" data-review-filter="flagged" aria-pressed="false">Marcadas · ' + counts.flagged + '</button>' : '') +
              '</div>' +
            '</div>' +
            '<div class="review-list" data-review-list></div>' +
          '</section>' +
        '</div>';

      renderReview();

      root.querySelectorAll('[data-review-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          filter = btn.dataset.reviewFilter;
          renderReview();
        });
      });

      root.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]');
        if (!action) return;
        if (action.dataset.action === 'retry') {
          launch(session.questionIds.slice(), session.mode, minutes, 'all');
        } else if (action.dataset.action === 'practice-failed') {
          launch(retryIds, 'practice', 0, 'failed');
        } else if (action.dataset.action === 'print') {
          window.print();
        }
      });
    }

    return {
      render,
      destroy() { rootEl = null; session = null; filter = 'all'; }
    };
  }

  window.ResultsView = ResultsView;
})();
