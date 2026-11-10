/* ============================================================
   views/settings.js — preferencias, datos y verificación
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;
  const Router = window.Router;

  const THEMES = [
    { id: 'dark', label: 'Oscuro' },
    { id: 'light', label: 'Claro' },
    { id: 'system', label: 'Sistema' }
  ];

  function themeSeg(current) {
    return '<div class="seg" role="group" aria-label="Tema de la interfaz">' +
      THEMES.map((theme) =>
        '<button type="button" class="seg-btn" data-theme-choice="' + theme.id + '" aria-pressed="' + (current === theme.id) + '">' +
          theme.label +
        '</button>'
      ).join('') +
    '</div>';
  }

  function textSeg(large) {
    return '<div class="seg" role="group" aria-label="Tamaño del texto">' +
      '<button type="button" class="seg-btn" data-text-choice="normal" aria-pressed="' + (!large) + '">Normal</button>' +
      '<button type="button" class="seg-btn" data-text-choice="large" aria-pressed="' + Boolean(large) + '">Grande</button>' +
    '</div>';
  }

  function exportProgress() {
    const payload = Store.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cgbvp-progreso-' + UI.dateKey() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    UI.toast('Progreso exportado como archivo JSON.', 'ok');
  }

  function settingsCounts() {
    const data = Store.get();
    const completed = data.sessions.filter((item) => item && item.finishedAt).length;
    return {
      completed,
      questions: Object.keys(data.progress || {}).length
    };
  }

  const SettingsView = {
    render(root) {
      const settings = Store.settings();
      const meta = Bank.meta() || {};
      const counts = Bank.counts();
      const local = settingsCounts();
      const persistent = Store.isPersistent();
      const appVersion = (window.App && window.App.version) || '1.0.0';

      root.innerHTML =
        UI.pageHead({
          eyebrow: 'Preferencias',
          title: 'Ajustes',
          lead: 'Configura la apariencia, la nota de referencia y el respaldo de tu progreso. Todo se guarda únicamente en el almacenamiento local de este navegador.',
          actions: '<button type="button" class="btn btn-ghost btn-sm" data-action="shortcuts">' +
            UI.icon('keyboard') + ' Atajos de teclado</button>'
        }) +

        '<div class="settings-grid">' +

          '<section class="card settings-card" aria-labelledby="set-appearance">' +
            '<h2 id="set-appearance">Apariencia</h2>' +
            '<p>Elige el tema y el tamaño de lectura que mejor se adapten a tu pantalla.</p>' +
            '<div class="setting-row">' +
              '<div class="setting-copy">' +
                '<strong>Tema de la interfaz</strong>' +
                '<span>El modo «Sistema» sigue la preferencia de color de tu dispositivo.</span>' +
              '</div>' +
              themeSeg(settings.theme) +
            '</div>' +
            '<div class="setting-row">' +
              '<div class="setting-copy">' +
                '<strong>Tamaño del texto</strong>' +
                '<span>Aumenta el tamaño base de toda la plataforma para facilitar la lectura.</span>' +
              '</div>' +
              textSeg(settings.textLarge) +
            '</div>' +
            '<div class="setting-row">' +
              '<div class="setting-copy">' +
                '<strong>Sonido de respuesta</strong>' +
                '<span>Reproduce un tono breve al responder en la práctica guiada.</span>' +
              '</div>' +
              '<label class="switch"><input type="checkbox" id="set-sound" aria-label="Activar sonido de respuesta"' +
                (settings.sound ? ' checked' : '') + '></label>' +
            '</div>' +
          '</section>' +

          '<section class="card settings-card" aria-labelledby="set-evaluation">' +
            '<h2 id="set-evaluation">Evaluación</h2>' +
            '<p>Ajusta la referencia con la que se compara la nota vigesimal de tus simulacros.</p>' +
            '<div class="setting-row">' +
              '<div class="setting-copy">' +
                '<strong>Nota mínima de referencia</strong>' +
                '<span id="pass-help">Valor sugerido a partir del ítem 2 del banco: 14 / 20. No altera la clave ni la calificación; solo el mensaje de referencia.</span>' +
              '</div>' +
              '<label class="sr-only" for="set-pass">Nota mínima de referencia sobre 20</label>' +
              '<input class="input" id="set-pass" type="number" min="0" max="20" step="0.5" inputmode="decimal" ' +
                'value="' + Number(settings.passScore).toFixed(1) + '" aria-describedby="pass-help" style="max-width:110px">' +
            '</div>' +
            '<div class="setting-row">' +
              '<div class="setting-copy">' +
                '<strong>Corrección de la práctica</strong>' +
                '<span>La práctica guiada muestra la clave justo después de responder. Los simulacros la reservan para el final.</span>' +
              '</div>' +
              '<span class="pill pill-muted">' + UI.icon('shield') + ' Fija por diseño</span>' +
            '</div>' +
            '<p class="about-note">Las preguntas en blanco se contabilizan como no acertadas al calcular la nota sobre el total de la sesión.</p>' +
          '</section>' +

          '<section class="card settings-card" aria-labelledby="set-data">' +
            '<h2 id="set-data">Datos y respaldo</h2>' +
            '<p>Tu progreso vive solo en este navegador. Exporta un respaldo antes de borrar los datos del sitio.</p>' +
            '<div class="about-list">' +
              '<div><dt>Almacenamiento local</dt><dd>' +
                '<span class="pill ' + (persistent ? 'pill-green' : 'pill-red') + '">' +
                  UI.icon(persistent ? 'check-circle' : 'alert') + (persistent ? ' Activo' : ' No disponible') +
                '</span></dd></div>' +
              '<div><dt>Clave de almacenamiento</dt><dd><code>' + UI.esc(Store.KEY) + '</code></dd></div>' +
              '<div><dt>Preguntas con historial</dt><dd>' + local.questions + ' / ' + counts.all + '</dd></div>' +
              '<div><dt>Sesiones completadas</dt><dd>' + local.completed + '</dd></div>' +
            '</div>' +
            '<div class="settings-actions">' +
              '<button type="button" class="btn btn-primary btn-sm" data-action="export">' + UI.icon('download') + ' Exportar</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-action="import">' + UI.icon('upload') + ' Importar</button>' +
              '<button type="button" class="btn btn-danger btn-sm" data-action="reset">' + UI.icon('trash') + ' Restablecer</button>' +
            '</div>' +
            '<input type="file" id="import-file" class="file-input" accept="application/json,.json">' +
            (persistent
              ? '<p class="about-note">El respaldo incluye preferencias, progreso por pregunta, actividad diaria e historial de sesiones.</p>'
              : '<p class="about-note" style="color:var(--red)">El navegador está bloqueando el almacenamiento local. Si abriste el archivo directamente, prueba a servir la carpeta con un servidor local o revisa la configuración de privacidad.</p>') +
          '</section>' +

          '<section class="card settings-card" aria-labelledby="set-source">' +
            '<h2 id="set-source">Fuente y verificación</h2>' +
            '<p>Datos del banco cargado y del proceso de extracción documental.</p>' +
            '<dl class="about-list">' +
              '<div><dt>Documento fuente</dt><dd>' + UI.esc(meta.source || 'Banco de 200 Preguntas.pdf') + '</dd></div>' +
              '<div><dt>Título del banco</dt><dd>' + UI.esc(meta.title || 'Balotario de ascensos 2026') + '</dd></div>' +
              '<div><dt>Preguntas</dt><dd>' + (meta.total || counts.all) + '</dd></div>' +
              '<div><dt>Alternativas por pregunta</dt><dd>' + (meta.optionsPerQuestion || 4) + '</dd></div>' +
              '<div><dt>Clave contrastada</dt><dd>' +
                '<span class="pill ' + (meta.answerKeyVerified ? 'pill-green' : 'pill-red') + '">' +
                  UI.icon(meta.answerKeyVerified ? 'check-circle' : 'alert') + ' ' +
                  (meta.answerKeyVerified ? '200 / 200' : 'Sin verificar') +
                '</span></dd></div>' +
              '<div><dt>Método de extracción</dt><dd>' + UI.esc(meta.extraction || 'pdf.js + MuPDF') + '</dd></div>' +
              '<div><dt>Fecha de extracción</dt><dd>' + UI.esc(meta.extractedAt || '—') + '</dd></div>' +
              '<div><dt>Versión de la aplicación</dt><dd>' + UI.esc(appVersion) + '</dd></div>' +
            '</dl>' +
            '<p class="about-note">' + UI.esc(meta.note || 'Contenido reproducido sin modificaciones desde el PDF fuente.') + '</p>' +
            '<div class="settings-actions">' +
              '<a class="btn btn-outline btn-sm" href="Banco%20de%20200%20Preguntas.pdf" target="_blank" rel="noopener">' +
                UI.icon('external') + ' Abrir PDF fuente</a>' +
              '<a class="btn btn-ghost btn-sm" href="#/banco">' + UI.icon('book') + ' Revisar el banco</a>' +
            '</div>' +
          '</section>' +

        '</div>' +

        '<section class="section">' +
          '<div class="source-banner">' +
            '<span class="source-icon">' + UI.icon('shield') + '</span>' +
            '<div>' +
              '<h3>Proyecto educativo no oficial</h3>' +
              '<p>Esta plataforma no está afiliada ni respaldada por el Cuerpo General de Bomberos Voluntarios del Perú. Las 200 preguntas, sus alternativas y la clave provienen exclusivamente del documento <cite>Banco de 200 Preguntas.pdf</cite>; no se inventó, corrigió ni reinterpretó ningún contenido. Verifica siempre la normativa vigente y las indicaciones oficiales.</p>' +
            '</div>' +
            '<a class="btn btn-outline btn-sm" href="#/inicio">Volver al inicio</a>' +
          '</div>' +
        '</section>';

      function sync() {
        const current = Store.settings();
        root.querySelectorAll('[data-theme-choice]').forEach((btn) => {
          btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === current.theme));
        });
        root.querySelectorAll('[data-text-choice]').forEach((btn) => {
          const value = btn.dataset.textChoice === 'large';
          btn.setAttribute('aria-pressed', String(value === Boolean(current.textLarge)));
        });
        const pass = root.querySelector('#set-pass');
        if (pass && document.activeElement !== pass) pass.value = Number(current.passScore).toFixed(1);
        const sound = root.querySelector('#set-sound');
        if (sound) sound.checked = Boolean(current.sound);
      }

      root.querySelectorAll('[data-theme-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Store.updateSettings({ theme: btn.dataset.themeChoice });
          if (window.App) window.App.applySettings();
          sync();
          UI.announce('Tema actualizado.');
        });
      });

      root.querySelectorAll('[data-text-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          Store.updateSettings({ textLarge: btn.dataset.textChoice === 'large' });
          if (window.App) window.App.applySettings();
          sync();
          UI.announce('Tamaño de texto actualizado.');
        });
      });

      const sound = root.querySelector('#set-sound');
      sound.addEventListener('change', () => {
        Store.updateSettings({ sound: sound.checked });
        UI.toast(sound.checked ? 'Sonido de respuesta activado.' : 'Sonido de respuesta desactivado.', 'info');
      });

      const pass = root.querySelector('#set-pass');
      pass.addEventListener('change', () => {
        let value = Number(pass.value);
        if (!Number.isFinite(value)) value = 14;
        value = Math.min(20, Math.max(0, Math.round(value * 10) / 10));
        Store.updateSettings({ passScore: value });
        pass.value = value.toFixed(1);
        UI.toast('Nota de referencia actualizada a ' + value.toFixed(1) + ' / 20.', 'ok');
      });

      const fileInput = root.querySelector('#import-file');

      root.querySelector('[data-action="export"]').addEventListener('click', exportProgress);
      root.querySelector('[data-action="import"]').addEventListener('click', () => fileInput.click());
      root.querySelector('[data-action="shortcuts"]').addEventListener('click', () => {
        if (window.App) window.App.openShortcuts();
      });

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const result = Store.importData(parsed);
          if (!result.ok) {
            UI.toast(result.error || 'No se pudo importar el archivo.', 'bad', 5000);
            return;
          }
          if (window.App) window.App.applySettings();
          UI.toast('Respaldo importado: ' + result.questions + ' preguntas y ' + result.sessions + ' sesiones.', 'ok', 4500);
          Router.render();
        } catch (err) {
          UI.toast('El archivo no es un JSON de respaldo válido.', 'bad', 5000);
        } finally {
          fileInput.value = '';
        }
      });

      root.querySelector('[data-action="reset"]').addEventListener('click', async () => {
        const ok = await UI.confirm({
          title: '¿Restablecer todo el progreso?',
          message: 'Se borrarán las preferencias, el historial de sesiones y el avance por pregunta guardados en este navegador. Esta acción no se puede deshacer.',
          body: '<div class="summary-mini">' +
            '<div><strong>' + local.completed + '</strong><span>Sesiones</span></div>' +
            '<div><strong>' + local.questions + '</strong><span>Preguntas</span></div>' +
            '<div><strong>0</strong><span>Tras borrar</span></div>' +
          '</div>',
          confirmLabel: 'Borrar todo',
          cancelLabel: 'Cancelar',
          danger: true
        });
        if (!ok) return;
        Store.reset();
        if (window.App) window.App.applySettings();
        UI.toast('Progreso restablecido. Puedes empezar de nuevo.', 'info');
        Router.render();
      });
    }
  };

  window.SettingsView = SettingsView;
})();
