/* ============================================================
   app.js — arranque, rutas, tema y atajos globales
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '1.0.0';
  const THEME_ORDER = ['dark', 'light', 'system'];
  const THEME_LABEL = { dark: 'Oscuro', light: 'Claro', system: 'Sistema' };
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function resolveTheme(theme) {
    if (theme === 'system') return mq && mq.matches ? 'light' : 'dark';
    return theme === 'light' ? 'light' : 'dark';
  }

  function updateThemeButton(theme) {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const iconName = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';
    const use = button.querySelector('use');
    if (use) use.setAttribute('href', '#i-' + iconName);
    const label = 'Tema actual: ' + (THEME_LABEL[theme] || 'Oscuro') + '. Cambiar tema';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function applyTheme(theme) {
    const setting = THEME_LABEL[theme] ? theme : 'dark';
    const resolved = resolveTheme(setting);
    document.documentElement.dataset.theme = resolved;
    updateThemeButton(setting);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#f2f5f8' : '#0a0f14');
  }

  function applySettings() {
    const settings = window.Store.settings();
    applyTheme(settings.theme);
    if (settings.textLarge) document.documentElement.dataset.text = 'large';
    else delete document.documentElement.dataset.text;
  }

  function toggleTheme() {
    const current = window.Store.settings().theme;
    const index = THEME_ORDER.indexOf(current);
    const next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
    window.Store.updateSettings({ theme: next });
    applySettings();
    window.UI.toast('Tema: ' + THEME_LABEL[next] + '.', 'info', 2200);
    window.UI.announce('Tema ' + THEME_LABEL[next].toLowerCase() + ' activado.');
  }

  function openShortcuts() {
    if (document.querySelector('.modal-backdrop')) return;
    const rows = [
      { keys: ['A', 'B', 'C', 'D'], text: 'Responder la alternativa correspondiente (también 1–4)' },
      { keys: ['F'], text: 'Marcar o desmarcar la pregunta actual' },
      { keys: ['N', '→'], text: 'Avanzar a la siguiente pregunta' },
      { keys: ['P', '←'], text: 'Volver a la pregunta anterior' },
      { keys: ['Espacio'], text: 'Revelar la respuesta en el modo estudio' },
      { keys: ['1', '2'], text: 'En estudio: la sabía / no la sabía tras revelar' },
      { keys: ['T'], text: 'Cambiar entre tema oscuro, claro y sistema' },
      { keys: ['?'], text: 'Mostrar esta ayuda de atajos' },
      { keys: ['Esc'], text: 'Salir de la sesión o cerrar un diálogo' }
    ];

    const body = '<div class="shortcuts-list">' + rows.map((row) =>
      '<div><span>' + window.UI.esc(row.text) + '</span>' +
        '<span class="keys">' + row.keys.map((key) => '<kbd>' + window.UI.esc(key) + '</kbd>').join('') + '</span>' +
      '</div>'
    ).join('') + '</div>' +
      '<p class="about-note">Los atajos se desactivan mientras escribes en un campo de texto o cuando hay un diálogo abierto.</p>';

    window.UI.openModal({
      title: 'Atajos de teclado',
      description: 'Resuelve más rápido sin soltar el teclado.',
      wide: true,
      body,
      actions: [{ label: 'Entendido', kind: 'primary', value: true }]
    });
  }

  function onGlobalKeydown(event) {
    if (document.querySelector('.modal-backdrop')) return;
    const target = event.target;
    const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
      event.preventDefault();
      openShortcuts();
      return;
    }
    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      toggleTheme();
    }
  }

  function bindChrome() {
    const button = document.getElementById('theme-toggle');
    if (button) button.addEventListener('click', toggleTheme);

    document.addEventListener('keydown', onGlobalKeydown);

    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());

    if (mq) {
      const onChange = () => {
        if (window.Store.settings().theme === 'system') applyTheme('system');
      };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
      else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    }
  }

  function registerRoutes() {
    const Router = window.Router;
    Router.register('/inicio', window.HomeView);
    Router.register('/practicar', window.PracticeView());
    Router.register('/simulacro', window.PracticeView());
    Router.register('/sesion', window.QuizView());
    Router.register('/resultados', window.ResultsView());
    Router.register('/banco', window.LibraryView());
    Router.register('/estudiar', window.StudyView());
    Router.register('/progreso', window.StatsView);
    Router.register('/ajustes', window.SettingsView);
  }

  function showFatalError(error) {
    const main = document.getElementById('main');
    if (!main) return;
    const message = error && error.message ? error.message : 'Error desconocido al cargar el banco de preguntas.';
    main.innerHTML =
      '<div class="empty-state" style="margin-top:70px">' +
        '<span class="empty-icon">' + window.UI.icon('alert') + '</span>' +
        '<h3>No se pudo cargar el banco de preguntas</h3>' +
        '<p>' + window.UI.esc(message) + '</p>' +
        '<p class="tiny muted">Comprueba que existan <code>data/questions.json</code> y <code>data/questions.js</code>, y que la página se sirva correctamente.</p>' +
        '<button type="button" class="btn btn-primary" onclick="window.location.reload()">Recargar</button>' +
      '</div>';
  }

  async function boot() {
    window.Store.load();
    applySettings();
    bindChrome();

    try {
      await window.Bank.load();
      registerRoutes();
      window.Router.start();
    } catch (error) {
      console.error(error);
      showFatalError(error);
      return;
    }

    if (!window.Store.isPersistent()) {
      window.setTimeout(() => {
        window.UI.toast('El almacenamiento local no está disponible. El progreso no se conservará al cerrar la página.', 'bad', 7000);
      }, 900);
    }
  }

  window.App = {
    version: VERSION,
    applySettings,
    applyTheme,
    toggleTheme,
    openShortcuts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
