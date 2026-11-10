/* ============================================================
   views/quiz.js — motor de sesión (práctica y simulacro)
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;
  const Router = window.Router;

  function QuizView() {
    let rootEl = null;
    let session = null;
    let timerId = null;
    let finishing = false;
    let milestone5 = false;
    let milestone1 = false;
    let audioCtx = null;

    function total() { return (session && session.questionIds ? session.questionIds.length : 0); }
    function currentId() { return session.questionIds[session.index]; }
    function answeredCount() { return Object.keys(session.answers || {}).length; }

    function currentQuestion() { return Bank.get(currentId()); }

    function playTone(ok) {
      if (!Store.settings().sound) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = ok ? 660 : 220;
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.24);
      } catch (err) { /* audio no disponible */ }
    }

    function optionState(question, letter) {
      const choice = session.answers[question.id] || null;
      const answered = Boolean(choice);
      const reveal = session.mode === 'practice' && answered;
      return {
        selected: choice === letter,
        correct: reveal && letter === question.answer,
        wrong: reveal && choice === letter && letter !== question.answer,
        dim: reveal && letter !== question.answer && choice !== letter,
        locked: reveal
      };
    }

    function feedbackHTML(question) {
      const choice = session.answers[question.id];
      if (session.mode !== 'practice' || !choice) return '';
      const ok = choice === question.answer;
      const correctOption = question.options.find((o) => o.letter === question.answer);
      const keyText = question.answer + ') ' + UI.esc(correctOption.text) + (/[.!?]$/.test(correctOption.text.trim()) ? '' : '.');
      return '<div class="feedback feedback--' + (ok ? 'ok' : 'bad') + '" role="status" tabindex="-1" id="answer-feedback">' +
        UI.icon(ok ? 'check-circle' : 'x-circle') +
        '<div>' +
          '<strong>' + (ok ? 'Respuesta correcta' : 'Respuesta incorrecta') + '</strong>' +
          '<p>' + (ok
            ? 'La clave del banco coincide: <strong>' + keyText + '</strong>'
            : 'Elegiste <strong>' + UI.esc(choice) + '</strong>. La clave del banco es <strong>' + keyText + '</strong>') +
          '</p>' +
        '</div>' +
      '</div>';
    }

    function renderQuestion(focusHeading) {
      const question = currentQuestion();
      if (!question) return;
      const position = session.index + 1;
      const isLast = session.index === total() - 1;
      const flagged = (session.flags || []).indexOf(question.id) !== -1;
      const choice = session.answers[question.id] || null;
      const revealed = session.mode === 'practice' && Boolean(choice);
      const feedback = feedbackHTML(question);

      const card = rootEl.querySelector('#q-card');
      if (!card) return;

      card.innerHTML =
        '<div class="q-head">' +
          '<span class="q-index"><strong>' + String(position).padStart(2, '0') + '</strong> / ' + total() +
            '<span class="pill pill-muted" style="margin-left:6px">Ítem ' + question.number + '</span></span>' +
          '<button type="button" class="q-flag" data-action="flag" aria-pressed="' + flagged + '">' +
            UI.icon('flag') + '<span>' + (flagged ? 'Marcada' : 'Marcar') + '</span>' +
          '</button>' +
        '</div>' +
        '<h2 class="q-text" id="q-text" tabindex="-1">' + UI.esc(question.text) + '</h2>' +
        '<div class="options" role="radiogroup" aria-labelledby="q-text">' +
          question.options.map((option) => UI.optionHTML(question, option, optionState(question, option.letter))).join('') +
        '</div>' +
        '<div class="feedback-slot" id="feedback-slot">' + feedback + '</div>' +
        '<div class="q-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="prev"' + (session.index === 0 ? ' disabled' : '') + '>' +
            UI.icon('arrow-left') + ' Anterior' +
          '</button>' +
          '<div class="right">' +
            '<button type="button" class="btn ' + (isLast ? 'btn-primary' : 'btn-ghost') + '" data-action="next">' +
              (isLast ? 'Finalizar' : 'Siguiente') + ' ' + UI.icon(isLast ? 'check' : 'arrow-right') +
            '</button>' +
          '</div>' +
        '</div>';

      // En práctica, las opciones ya respondidas quedan bloqueadas visualmente.
      if (revealed) {
        card.querySelectorAll('.option input').forEach((input) => { input.disabled = true; });
      }

      if (focusHeading) {
        const heading = card.querySelector('#q-text');
        if (heading) heading.focus({ preventScroll: true });
      }
      updateChrome();
    }

    function navLabel(index) {
      const id = session.questionIds[index];
      const answered = Boolean(session.answers[id]);
      const flagged = (session.flags || []).indexOf(id) !== -1;
      return 'Pregunta ' + (index + 1) + ', ítem ' + id + (answered ? ', respondida' : ', sin responder') + (flagged ? ', marcada' : '');
    }

    function updateChrome() {
      const totalQ = total();
      const answered = answeredCount();
      const flagged = (session.flags || []).length;
      const pct = totalQ ? Math.round((answered / totalQ) * 100) : 0;

      const bar = rootEl.querySelector('[data-progress-bar]');
      if (bar) bar.style.width = pct + '%';
      const progressText = rootEl.querySelector('[data-progress-text]');
      if (progressText) progressText.textContent = 'Respondidas ' + answered + ' de ' + totalQ + ' · ' + pct + '%';
      const navCount = rootEl.querySelector('[data-nav-count]');
      if (navCount) navCount.textContent = answered + '/' + totalQ;

      const metaAnswered = rootEl.querySelector('[data-meta-answered]');
      if (metaAnswered) metaAnswered.textContent = answered + ' / ' + totalQ;
      const metaBlank = rootEl.querySelector('[data-meta-blank]');
      if (metaBlank) metaBlank.textContent = String(totalQ - answered);
      const metaFlags = rootEl.querySelector('[data-meta-flags]');
      if (metaFlags) metaFlags.textContent = String(flagged);

      rootEl.querySelectorAll('[data-nav-index]').forEach((btn) => {
        const index = Number(btn.dataset.navIndex);
        const id = session.questionIds[index];
        btn.classList.toggle('is-answered', Boolean(session.answers[id]));
        btn.classList.toggle('is-flagged', (session.flags || []).indexOf(id) !== -1);
        btn.classList.toggle('is-current', index === session.index);
        btn.setAttribute('aria-label', navLabel(index));
        if (index === session.index) btn.setAttribute('aria-current', 'true');
        else btn.removeAttribute('aria-current');
      });
    }

    function save() {
      Store.updateActive({
        answers: session.answers,
        flags: session.flags,
        index: session.index
      });
    }

    function selectOption(letter) {
      const question = currentQuestion();
      if (!question) return;
      const already = session.answers[question.id];
      if (session.mode === 'practice' && already) return;
      if (!question.options.some((o) => o.letter === letter)) return;

      session.answers[question.id] = letter;
      save();

      const card = rootEl.querySelector('#q-card');
      if (!card) return;
      card.querySelectorAll('.option').forEach((label) => {
        const input = label.querySelector('input');
        const isChoice = input.value === letter;
        input.checked = isChoice;
        label.classList.toggle('is-selected', isChoice);
        if (session.mode === 'practice') {
          const isCorrect = input.value === question.answer;
          label.classList.toggle('is-correct', isCorrect);
          label.classList.toggle('is-wrong', isChoice && !isCorrect);
          label.classList.toggle('is-dim', !isCorrect && !isChoice);
          label.classList.add('is-locked');
          input.disabled = true;
          const mark = label.querySelector('.option-mark');
          if (mark) mark.innerHTML = isCorrect ? UI.icon('check') : (isChoice ? UI.icon('x') : '');
        }
      });

      if (session.mode === 'practice') {
        const slot = rootEl.querySelector('#feedback-slot');
        if (slot) slot.innerHTML = feedbackHTML(question);
        const feedback = rootEl.querySelector('#answer-feedback');
        if (feedback) feedback.focus({ preventScroll: true });
        playTone(letter === question.answer);
      }

      updateChrome();
    }

    function goTo(index, focusHeading) {
      if (index < 0 || index >= total()) return;
      session.index = index;
      save();
      renderQuestion(focusHeading !== false);
    }

    function toggleFlag() {
      const id = currentId();
      const flags = session.flags || [];
      const at = flags.indexOf(id);
      if (at === -1) flags.push(id);
      else flags.splice(at, 1);
      session.flags = flags;
      save();
      const btn = rootEl.querySelector('[data-action="flag"]');
      if (btn) {
        const on = flags.indexOf(id) !== -1;
        btn.setAttribute('aria-pressed', String(on));
        btn.querySelector('span').textContent = on ? 'Marcada' : 'Marcar';
      }
      updateChrome();
    }

    function computeResult() {
      const finishedAt = new Date().toISOString();
      const answers = {};
      const checks = {};
      let correct = 0, wrong = 0, blank = 0;

      session.questionIds.forEach((id) => {
        const question = Bank.get(id);
        const choice = session.answers[id] || null;
        answers[id] = choice;
        if (!choice) { checks[id] = 'blank'; blank += 1; return; }
        if (choice === question.answer) { checks[id] = 'correct'; correct += 1; }
        else { checks[id] = 'wrong'; wrong += 1; }
      });

      const totalQ = session.questionIds.length;
      const answered = correct + wrong;
      const score20 = UI.score20(correct, totalQ);
      const passScore = Store.settings().passScore;
      const startedAt = session.startedAt || finishedAt;
      const durationSec = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));

      return {
        id: session.id,
        mode: session.mode,
        startedAt,
        finishedAt,
        durationSec,
        timeLimitSec: session.timeLimitSec || 0,
        questionIds: session.questionIds.slice(),
        answers,
        checks,
        flags: (session.flags || []).slice(),
        correct,
        wrong,
        blank,
        answered,
        total: totalQ,
        percent: totalQ ? Math.round((correct / totalQ) * 100) : 0,
        score20,
        passScore,
        passed: score20 >= passScore,
        config: session.config || {}
      };
    }

    function finishSession(auto) {
      if (finishing) return;
      finishing = true;
      if (timerId) { clearInterval(timerId); timerId = null; }
      const result = computeResult();
      Store.completeSession(result);
      UI.closeModal();
      if (auto) UI.toast('Tiempo agotado. La sesión se calificó automáticamente.', 'info', 4200);
      Router.go('/resultados');
    }

    async function askFinish() {
      const totalQ = total();
      const answered = answeredCount();
      const flagged = (session.flags || []).length;
      const blank = totalQ - answered;
      const ok = await UI.openModal({
        title: '¿Finalizar la sesión?',
        description: session.mode === 'exam'
          ? 'Se calificará con la clave del banco. Las preguntas sin responder se registrarán en blanco.'
          : 'Podrás revisar el resultado y la clave de cada pregunta.',
        body: '<div class="summary-mini">' +
          '<div><strong>' + answered + '</strong><span>Respondidas</span></div>' +
          '<div><strong>' + blank + '</strong><span>En blanco</span></div>' +
          '<div><strong>' + flagged + '</strong><span>Marcadas</span></div>' +
        '</div>',
        actions: [
          { label: 'Seguir resolviendo', kind: 'ghost', value: false },
          { label: 'Finalizar y calificar', kind: 'primary', value: true }
        ]
      });
      if (ok) finishSession(false);
    }

    async function askExit() {
      const ok = await UI.confirm({
        title: 'Salir de la sesión',
        message: 'Tu sesión se guardará y podrás continuarla desde el inicio. Si tiene cronómetro, el tiempo seguirá corriendo.',
        confirmLabel: 'Salir y guardar',
        cancelLabel: 'Seguir resolviendo'
      });
      if (ok) Router.go('/inicio');
    }

    function updateTimer() {
      if (!session) return;
      const display = rootEl && rootEl.querySelector('[data-timer]');
      if (!display) return;

      if (session.endsAt) {
        const remaining = Math.max(0, Math.round((session.endsAt - Date.now()) / 1000));
        const limit = session.timeLimitSec || 0;
        display.textContent = UI.fmtClock(remaining);
        display.classList.toggle('is-critical', remaining <= 60);
        display.classList.toggle('is-warn', remaining > 60 && remaining <= Math.min(300, limit * 0.25));
        if (limit > 360 && remaining <= 300 && !milestone5) {
          milestone5 = true;
          UI.announce('Quedan 5 minutos o menos de evaluación.');
        }
        if (limit > 120 && remaining <= 60 && !milestone1) {
          milestone1 = true;
          UI.announce('Queda 1 minuto de evaluación.');
        }
        if (remaining <= 0) finishSession(true);
      } else {
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
        display.textContent = UI.fmtClock(elapsed);
      }
    }

    function onKeydown(event) {
      if (document.querySelector('.modal-backdrop')) return;
      const target = event.target;
      const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
      const isRadio = tag === 'input' && target.type === 'radio';
      if ((tag === 'input' && !isRadio) || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();
      const map = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      if (map[key]) {
        event.preventDefault();
        selectOption(map[key]);
        return;
      }
      if (key === 'f') { event.preventDefault(); toggleFlag(); return; }
      if (key === 'n' || key === 'arrowright') {
        // En un grupo de radios, las flechas conservan la navegación nativa.
        if (key === 'arrowright' && isRadio) return;
        event.preventDefault();
        if (session.index === total() - 1) askFinish();
        else goTo(session.index + 1);
        return;
      }
      if (key === 'p' || key === 'arrowleft') {
        if (key === 'arrowleft' && isRadio) return;
        event.preventDefault();
        goTo(session.index - 1);
        return;
      }
      if (key === 'escape') {
        event.preventDefault();
        askExit();
      }
    }

    function render(root) {
      rootEl = root;
      session = Store.get().active;

      if (!session || !Array.isArray(session.questionIds) || !session.questionIds.length) {
        root.innerHTML = '<div class="boot-loading"><p>No hay una sesión activa.</p><a class="btn btn-primary" href="#/practicar">Configurar una sesión</a></div>';
        window.setTimeout(() => Router.go('/practicar'), 600);
        return;
      }

      session.answers = session.answers || {};
      session.flags = session.flags || [];
      session.index = Math.min(Math.max(0, Number(session.index) || 0), session.questionIds.length - 1);

      if (session.endsAt && Date.now() >= session.endsAt) {
        root.innerHTML = '<div class="boot-loading"><span class="spinner" aria-hidden="true"></span><p>El tiempo terminó. Calificando la sesión…</p></div>';
        window.setTimeout(() => finishSession(true), 400);
        return;
      }

      const modeLabel = session.mode === 'exam' ? 'Simulacro' : 'Práctica';
      const scopeLabel = session.config && session.config.scope
        ? ({ all: 'Banco completo', new: 'Sin responder', failed: 'Falladas', unmastered: 'No dominadas' })[session.config.scope] || 'Banco completo'
        : 'Banco completo';
      const timerBlock = session.endsAt
        ? '<div class="side-title"><span>Tiempo restante</span>' + UI.icon('timer') + '</div>' +
          '<div class="timer-display" data-timer aria-label="Tiempo restante">' + UI.fmtClock((session.endsAt - Date.now()) / 1000) + '</div>' +
          '<div class="timer-note">Se califica automáticamente al llegar a cero.</div>'
        : '<div class="side-title"><span>Tiempo transcurrido</span>' + UI.icon('clock') + '</div>' +
          '<div class="timer-display" data-timer aria-label="Tiempo transcurrido">' + UI.fmtClock((Date.now() - new Date(session.startedAt).getTime()) / 1000) + '</div>' +
          '<div class="timer-note">Sesión sin límite de tiempo.</div>';

      root.innerHTML =
        '<h1 class="sr-only">' + (session.mode === 'exam' ? 'Simulacro en curso' : 'Práctica en curso') + '</h1>' +
        '<div class="quiz-shell">' +
          '<div class="quiz-top">' +
            '<div class="quiz-top-left">' +
              '<span class="pill ' + (session.mode === 'exam' ? 'pill-amber' : 'pill-brand') + '">' +
                UI.icon(session.mode === 'exam' ? 'timer' : 'target') + ' ' + modeLabel +
              '</span>' +
              '<span class="pill pill-muted">' + UI.esc(scopeLabel) + '</span>' +
              '<span class="pill pill-muted">' + (session.config && session.config.order === 'ascending' ? 'Orden por número' : 'Orden aleatorio') + '</span>' +
            '</div>' +
            '<div class="quiz-top-right">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-action="exit">' + UI.icon('x') + ' Salir</button>' +
            '</div>' +
          '</div>' +
          '<div class="quiz-progress">' +
            '<div class="row"><span data-progress-text>Respondidas 0 de ' + total() + '</span><span>' + (session.mode === 'exam' ? 'Corrección al finalizar' : 'Corrección inmediata') + '</span></div>' +
            '<div class="bar"><i data-progress-bar style="width:0%"></i></div>' +
          '</div>' +
          '<div class="quiz-grid">' +
            '<div class="quiz-main"><article class="q-card" id="q-card" aria-label="Pregunta actual"></article></div>' +
            '<aside class="quiz-side" aria-label="Panel de la sesión">' +
              '<section class="side-card">' + timerBlock + '</section>' +
              '<section class="side-card side-card--nav">' +
                '<div class="side-title"><span>Navegador</span><span data-nav-count>0/' + total() + '</span></div>' +
                '<div class="nav-grid">' +
                  session.questionIds.map((id, index) =>
                    '<button type="button" class="nav-dot" data-nav-index="' + index + '" aria-label="' + navLabel(index) + '">' + (index + 1) + '</button>'
                  ).join('') +
                '</div>' +
                '<div class="nav-legend">' +
                  '<span><i class="answered"></i> Respondida</span>' +
                  '<span><i class="flagged"></i> Marcada</span>' +
                  '<span><i class="current"></i> Actual</span>' +
                '</div>' +
              '</section>' +
              '<section class="side-card">' +
                '<div class="side-meta">' +
                  '<div><span>Respondidas</span><strong data-meta-answered>0 / ' + total() + '</strong></div>' +
                  '<div><span>En blanco</span><strong data-meta-blank>' + total() + '</strong></div>' +
                  '<div><span>Marcadas</span><strong data-meta-flags>0</strong></div>' +
                '</div>' +
                '<button type="button" class="btn btn-primary btn-block" style="margin-top:14px" data-action="finish">' +
                  UI.icon('check') + ' Finalizar sesión' +
                '</button>' +
                '<div class="kbd-hint" style="margin-top:12px">' +
                  '<kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> responder · <kbd>F</kbd> marcar · <kbd>N</kbd> siguiente' +
                '</div>' +
              '</section>' +
            '</aside>' +
          '</div>' +
        '</div>';

      renderQuestion(false);
      updateChrome();
      updateTimer();
      timerId = window.setInterval(updateTimer, 500);

      const quizMain = root.querySelector('.quiz-main');
      quizMain.addEventListener('change', (event) => {
        if (event.target && event.target.matches('input[type="radio"]')) {
          selectOption(event.target.value);
        }
      });

      root.querySelector('.quiz-side').addEventListener('click', (event) => {
        const navBtn = event.target.closest('[data-nav-index]');
        if (navBtn) { goTo(Number(navBtn.dataset.navIndex)); return; }
      });

      root.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]');
        if (!action) return;
        const name = action.dataset.action;
        if (name === 'prev') goTo(session.index - 1);
        else if (name === 'next') {
          if (session.index === total() - 1) askFinish();
          else goTo(session.index + 1);
        } else if (name === 'flag') toggleFlag();
        else if (name === 'finish') askFinish();
        else if (name === 'exit') askExit();
      });

      document.addEventListener('keydown', onKeydown);
    }

    return {
      render,
      destroy() {
        if (timerId) { clearInterval(timerId); timerId = null; }
        document.removeEventListener('keydown', onKeydown);
        rootEl = null;
        session = null;
        finishing = false;
        milestone5 = false;
        milestone1 = false;
      }
    };
  }

  window.QuizView = QuizView;
})();
