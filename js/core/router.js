/* ============================================================
   router.js — enrutado por hash para sitio estático
   ============================================================ */
(function () {
  'use strict';

  const routes = new Map();
  let currentView = null;
  let currentPath = null;
  let started = false;

  const NAV_MAP = {
    '/inicio': 'inicio',
    '/practicar': 'practicar',
    '/simulacro': 'simulacro',
    '/banco': 'banco',
    '/estudiar': 'banco',
    '/progreso': 'progreso',
    '/ajustes': 'ajustes',
    '/resultados': 'progreso',
    '/sesion': ''
  };

  function register(path, view) {
    routes.set(path, view);
  }

  function parse() {
    const raw = window.location.hash.replace(/^#/, '') || '/inicio';
    const split = raw.split('?');
    const path = split[0] || '/inicio';
    const params = new URLSearchParams(split[1] || '');
    return { path, params };
  }

  function go(path) {
    const target = path.charAt(0) === '#' ? path : '#' + path;
    if (window.location.hash === target) {
      render();
    } else {
      window.location.hash = target;
    }
  }

  function setActiveNav(path) {
    const key = NAV_MAP[path] || '';
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = key && link.dataset.nav === key;
      link.classList.toggle('is-active', Boolean(active));
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function render() {
    const { path, params } = parse();
    const view = routes.get(path) || routes.get('/inicio');

    if (currentView && typeof currentView.destroy === 'function') {
      try { currentView.destroy(); } catch (err) { console.warn('Error al destruir la vista', err); }
    }
    currentView = null;
    currentPath = path;

    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = '';
    main.classList.remove('view-enter');
    // Forzar reinicio de la animación de entrada.
    void main.offsetWidth;
    main.classList.add('view-enter');

    setActiveNav(path);

    Promise.resolve()
      .then(() => view.render(main, params))
      .then(() => {
        currentView = view;
        window.scrollTo(0, 0);
        const heading = main.querySelector('h1');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      })
      .catch((err) => {
        console.error('Error al renderizar la vista', err);
        main.innerHTML =
          '<div class="empty-state" style="margin-top:60px">' +
            '<span class="empty-icon">' + window.UI.icon('alert') + '</span>' +
            '<h3>No se pudo cargar esta sección</h3>' +
            '<p>Ocurrió un error inesperado. Recarga la página o vuelve al inicio.</p>' +
            '<a class="btn btn-primary" href="#/inicio">Volver al inicio</a>' +
          '</div>';
      });
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.location.hash) {
      try { window.history.replaceState(null, '', '#/inicio'); }
      catch (err) { window.location.hash = '#/inicio'; }
    }
    window.addEventListener('hashchange', render);
    render();
  }

  window.Router = {
    register,
    start,
    go,
    parse,
    render,
    getPath: () => currentPath
  };
})();
