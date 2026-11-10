/* ============================================================
   views/practice.js — configuración de práctica y simulacro
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;
  const Router = window.Router;

  const COUNT_PRESETS = [10, 20, 40, 50, 100, 200];
  const TIME_PRESETS = [0, 10, 20, 30, 45, 60, 90];

  const SCOPES = [
    { id: 'all', label: 'Banco completo', note: 'Las 200 preguntas' },
    { id: 'new', label: 'Sin responder', note: 'Aún no intentadas' },
    { id: 'failed', label: 'Falladas', note: 'Última respuesta incorrecta' },
    { id: 'unmastered', label: 'No dominadas', note: 'Menos de 2 aciertos seguidos' }
  ];

  function scopeInfo(id) {
    return SCOPES.find((s) => s.id === id) || SCOPES[0];
  }

  function PracticeView() {
    let config = null;
    let counts = null;
    let rootEl = null;

    function availableFor(scope) {
      return Bank.pool(scope).length;
    }

    function effectiveCount() {
      return Math.min(config.count, availableFor(config.scope));
    }

    function sync() {
      if (!rootEl) return;

      rootEl.querySelectorAll('[data-count-preset]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.countPreset) === config.count));
      });
      rootEl.querySelectorAll('[data-time-preset]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.timePreset) === config.minutes));
      });
      rootEl.querySelectorAll('[data-scope]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.scope === config.scope));
      });
      rootEl.querySelectorAll('[data-order]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.order === config.order));
      });
      rootEl.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === config.mode));
      });

      const countInput = rootEl.querySelector('#cfg-count');
      if (countInput && document.activeElement !== countInput) countInput.value = config.count;
      const timeInput = rootEl.querySelector('#cfg-time');
      if (timeInput && document.activeElement !== timeInput) timeInput.value = config.minutes;

      const available = availableFor(config.scope);
      const effective = effectiveCount();
      const availableNote = rootEl.querySelector('[data-available-note]');
      if (availableNote) {
        availableNote.textContent = available + ' ' + UI.plural(available, 'pregunta disponible', 'preguntas disponibles') + ' en este alcance.';
      }

      const summary = rootEl.querySelector('[data-summary]');
      if (!summary) return;
      const modeLabel = config.mode === 'exam' ? 'Simulacro' : 'Práctica';
      const timeLabel = config.minutes > 0 ? config.minutes + ' min' : 'Sin límite';
      const orderLabel = config.order === 'random' ? 'Aleatorio' : 'Por número';
      const feedbackLabel = config.mode === 'exam' ? 'Al finalizar' : 'Inmediata';
      const passScore = Store.settings().passScore;

      summary.innerHTML =
        '<div class="summary-list">' +
          '<div><dt>Modo</dt><dd>' + modeLabel + '</dd></div>' +
          '<div><dt>Preguntas</dt><dd class="big">' + effective + '</dd></div>' +
          '<div><dt>Tiempo</dt><dd>' + timeLabel + '</dd></div>' +
          '<div><dt>Alcance</dt><dd>' + UI.esc(scopeInfo(config.scope).label) + '</dd></div>' +
          '<div><dt>Orden</dt><dd>' + orderLabel + '</dd></div>' +
          '<div><dt>Corrección</dt><dd>' + feedbackLabel + '</dd></div>' +
          (config.mode === 'exam' ? '<div><dt>Nota de referencia</dt><dd>' + passScore.toFixed(1) + ' / 20</dd></div>' : '') +
        '</div>' +
        (effective < config.count
          ? '<div class="summary-alert">' + UI.icon('info') + ' Solo hay ' + available + ' preguntas en este alcance. Se usarán todas.</div>'
          : '') +
        (available === 0
          ? '<div class="summary-alert summary-alert--danger">' + UI.icon('alert') + ' No hay preguntas disponibles con este alcance. Elige otro o restablece filtros.</div>'
          : '') +
        '<button type="button" class="btn btn-primary btn-lg btn-block" data-action="start" ' + (available === 0 ? 'disabled' : '') + '>' +
          UI.icon('play') + ' ' + (config.mode === 'exam' ? 'Comenzar simulacro' : 'Comenzar práctica') +
        '</button>' +
        '<p class="tiny muted" style="margin-top:12px;text-align:center">El avance se guarda automáticamente en este navegador.</p>';

      const startBtn = summary.querySelector('[data-action="start"]');
      if (startBtn) startBtn.addEventListener('click', start);
    }

    async function start() {
      const ids = Bank.pool(config.scope);
      if (!ids.length) {
        UI.toast('No hay preguntas disponibles con el alcance elegido.', 'bad');
        return;
      }
      const count = Math.min(config.count, ids.length);
      let chosen = config.order === 'random' ? UI.shuffle(ids).slice(0, count) : ids.slice().sort((a, b) => a - b).slice(0, count);

      const begin = () => {
        const session = {
          id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          mode: config.mode,
          questionIds: chosen,
          answers: {},
          flags: [],
          index: 0,
          startedAt: new Date().toISOString(),
          endsAt: config.minutes > 0 ? Date.now() + config.minutes * 60000 : null,
          timeLimitSec: config.minutes * 60,
          config: {
            count: chosen.length,
            minutes: config.minutes,
            scope: config.scope,
            order: config.order
          }
        };
        Store.startSession(session);
        Router.go('/sesion');
      };

      const active = Store.get().active;
      if (active) {
        const decision = await UI.openModal({
          title: 'Ya tienes una sesión en curso',
          description: 'Puedes continuar donde la dejaste o descartarla para comenzar esta nueva configuración.',
          body: '<div class="summary-mini">' +
            '<div><strong>' + Object.keys(active.answers || {}).length + '</strong><span>Respondidas</span></div>' +
            '<div><strong>' + (active.questionIds || []).length + '</strong><span>En total</span></div>' +
            '<div><strong>' + (active.mode === 'exam' ? 'Examen' : 'Práctica') + '</strong><span>Modo</span></div>' +
          '</div>',
          actions: [
            { label: 'Cancelar', kind: 'ghost', value: null },
            { label: 'Continuar la sesión', kind: 'outline', value: 'resume' },
            { label: 'Empezar nueva', kind: 'primary', value: 'new' }
          ]
        });
        if (decision === 'resume') { Router.go('/sesion'); return; }
        if (decision !== 'new') return;
      }

      begin();
    }

    function render(root, params) {
      rootEl = root;
      const path = Router.getPath();
      const isExam = path === '/simulacro' || params.get('modo') === 'examen';
      const settings = Store.settings();
      counts = Bank.counts();

      config = {
        mode: isExam ? 'exam' : 'practice',
        count: isExam ? 40 : 20,
        minutes: isExam ? 40 : 0,
        scope: 'all',
        order: 'random',
        instant: settings.instantFeedback
      };

      const active = Store.get().active;
      const available = availableFor(config.scope);

      root.innerHTML =
        UI.pageHead({
          eyebrow: isExam ? 'Evaluación' : 'Entrenamiento',
          title: isExam ? 'Simulacro cronometrado' : 'Configura tu práctica',
          lead: isExam
            ? 'Resuelve una selección de preguntas en condiciones de examen. Al finalizar obtendrás tu nota vigesimal, el detalle de aciertos y la revisión de cada respuesta.'
            : 'Elige cuántas preguntas resolver y si quieres tiempo límite. En práctica, cada respuesta se corrige al instante con la clave del banco.',
          actions: '<a class="btn btn-ghost btn-sm" href="#/banco">' + UI.icon('book') + ' Consultar el banco</a>'
        }) +
        (active
          ? '<div class="resume-banner" style="margin-top:0;margin-bottom:22px">' +
              '<span class="resume-icon">' + UI.icon('play') + '</span>' +
              '<div><strong>Tienes una sesión sin terminar</strong><span>' + Object.keys(active.answers || {}).length + ' de ' + (active.questionIds || []).length + ' respondidas</span></div>' +
              '<a class="btn btn-primary btn-sm" href="#/sesion">Continuar</a>' +
            '</div>'
          : '') +
        '<div class="config-grid">' +
          '<div class="config-form">' +

            '<section class="config-block">' +
              '<div class="block-head"><div><h2><span class="num">01</span> Tipo de sesión</h2>' +
                '<p class="block-note">La diferencia está en cuándo ves la corrección.</p></div></div>' +
              '<div class="mode-choice" role="group" aria-label="Tipo de sesión">' +
                '<button type="button" class="mode-opt" data-mode="practice">' +
                  '<strong>' + UI.icon('target') + ' Práctica guiada</strong>' +
                  '<span>Corrección inmediata tras cada respuesta. Ideal para aprender y fijar la clave.</span>' +
                '</button>' +
                '<button type="button" class="mode-opt" data-mode="exam">' +
                  '<strong>' + UI.icon('timer') + ' Simulacro</strong>' +
                  '<span>Sin corrección hasta el final. Calificación automática y revisión completa.</span>' +
                '</button>' +
              '</div>' +
            '</section>' +

            '<section class="config-block">' +
              '<div class="block-head"><div><h2><span class="num">02</span> Cantidad de preguntas</h2>' +
                '<p class="block-note">Del 1 al 200. Puedes combinar presets o escribir una cifra.</p></div></div>' +
              '<div class="chip-row" role="group" aria-label="Cantidad de preguntas">' +
                COUNT_PRESETS.map((n) => '<button type="button" class="chip" data-count-preset="' + n + '" aria-pressed="false">' + n + '</button>').join('') +
              '</div>' +
              '<div class="row" style="margin-top:12px">' +
                '<label class="tiny muted" for="cfg-count">Otra cantidad</label>' +
                '<input class="input" id="cfg-count" type="number" min="1" max="200" step="1" value="' + config.count + '" inputmode="numeric">' +
                '<span class="tiny muted" data-available-note>' + available + ' preguntas disponibles en este alcance.</span>' +
              '</div>' +
            '</section>' +

            '<section class="config-block">' +
              '<div class="block-head"><div><h2><span class="num">03</span> Tiempo disponible</h2>' +
                '<p class="block-note">0 minutos equivale a resolver sin cronómetro.</p></div></div>' +
              '<div class="chip-row" role="group" aria-label="Tiempo disponible">' +
                TIME_PRESETS.map((n) => '<button type="button" class="chip" data-time-preset="' + n + '" aria-pressed="false">' + (n === 0 ? 'Sin límite' : n + ' min') + '</button>').join('') +
              '</div>' +
              '<div class="row" style="margin-top:12px">' +
                '<label class="tiny muted" for="cfg-time">Minutos</label>' +
                '<input class="input" id="cfg-time" type="number" min="0" max="300" step="1" value="' + config.minutes + '" inputmode="numeric">' +
                '<span class="tiny muted">El cronómetro se inicia al comenzar y sigue corriendo si sales de la sesión.</span>' +
              '</div>' +
            '</section>' +

            '<section class="config-block">' +
              '<div class="block-head"><div><h2><span class="num">04</span> Alcance y orden</h2>' +
                '<p class="block-note">Filtra por tu historial y decide el orden de las preguntas.</p></div></div>' +
              '<div class="field" style="margin-bottom:16px">' +
                '<span class="field-label">Preguntas a incluir</span>' +
                '<div class="chip-row" role="group" aria-label="Alcance de las preguntas">' +
                  SCOPES.map((s) =>
                    '<button type="button" class="chip" data-scope="' + s.id + '" aria-pressed="false" title="' + UI.esc(s.note) + '">' +
                      UI.esc(s.label) + ' · ' + (s.id === 'all' ? counts.all : counts[s.id]) +
                    '</button>'
                  ).join('') +
                '</div>' +
              '</div>' +
              '<div class="field">' +
                '<span class="field-label">Orden</span>' +
                '<div class="seg" role="group" aria-label="Orden de las preguntas">' +
                  '<button type="button" class="seg-btn" data-order="random" aria-pressed="false">Aleatorio</button>' +
                  '<button type="button" class="seg-btn" data-order="ascending" aria-pressed="false">Por número</button>' +
                '</div>' +
              '</div>' +
              '<div class="block-help">' + UI.icon('info') + ' Nunca se altera el orden de las alternativas ni la clave de respuestas: solo cambia el orden de las preguntas.</div>' +
            '</section>' +

          '</div>' +
          '<aside class="summary-card" aria-label="Resumen de la sesión">' +
            '<h2>Resumen</h2>' +
            '<p class="summary-sub">Revisa la configuración antes de comenzar.</p>' +
            '<div data-summary></div>' +
          '</aside>' +
        '</div>';

      // Eventos de configuración
      root.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          config.mode = btn.dataset.mode;
          config.instant = config.mode === 'practice';
          sync();
        });
      });
      root.querySelectorAll('[data-count-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          config.count = Number(btn.dataset.countPreset);
          sync();
        });
      });
      root.querySelectorAll('[data-time-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          config.minutes = Number(btn.dataset.timePreset);
          sync();
        });
      });
      root.querySelectorAll('[data-scope]').forEach((btn) => {
        btn.addEventListener('click', () => {
          config.scope = btn.dataset.scope;
          sync();
        });
      });
      root.querySelectorAll('[data-order]').forEach((btn) => {
        btn.addEventListener('click', () => {
          config.order = btn.dataset.order;
          sync();
        });
      });

      const countInput = root.querySelector('#cfg-count');
      countInput.addEventListener('input', () => {
        const value = Number(countInput.value);
        if (Number.isFinite(value) && value >= 1 && value <= 200) {
          config.count = Math.round(value);
          sync();
        }
      });
      countInput.addEventListener('blur', () => {
        let value = Math.round(Number(countInput.value));
        if (!Number.isFinite(value) || value < 1) value = 1;
        if (value > 200) value = 200;
        config.count = value;
        countInput.value = value;
        sync();
      });

      const timeInput = root.querySelector('#cfg-time');
      timeInput.addEventListener('input', () => {
        const value = Number(timeInput.value);
        if (Number.isFinite(value) && value >= 0 && value <= 300) {
          config.minutes = Math.round(value);
          sync();
        }
      });
      timeInput.addEventListener('blur', () => {
        let value = Math.round(Number(timeInput.value));
        if (!Number.isFinite(value) || value < 0) value = 0;
        if (value > 300) value = 300;
        config.minutes = value;
        timeInput.value = value;
        sync();
      });

      sync();
    }

    return {
      render,
      destroy() {
        rootEl = null;
      }
    };
  }

  window.PracticeView = PracticeView;
})();
