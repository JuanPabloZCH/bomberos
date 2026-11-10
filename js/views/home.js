/* ============================================================
   views/home.js — panel de inicio
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;

  function modeCards() {
    return '<div class="mode-grid">' +
      '<a class="mode-card" href="#/practicar" data-tone="red">' +
        '<span class="mode-icon">' + UI.icon('target') + '</span>' +
        '<h3>Práctica guiada</h3>' +
        '<p>Avanza pregunta por pregunta con corrección inmediata y la alternativa correcta siempre a la vista.</p>' +
        '<div class="mode-meta"><span>Feedback inmediato</span><span>Tiempo opcional</span></div>' +
        '<span class="mode-link">Configurar práctica ' + UI.icon('arrow-right') + '</span>' +
      '</a>' +
      '<a class="mode-card" href="#/simulacro" data-tone="amber">' +
        '<span class="mode-icon">' + UI.icon('timer') + '</span>' +
        '<h3>Simulacro cronometrado</h3>' +
        '<p>Resuelve en condiciones de examen. Calificación automática, nota vigesimal y revisión completa.</p>' +
        '<div class="mode-meta"><span>Cronómetro</span><span>Nota /20</span></div>' +
        '<span class="mode-link">Iniciar simulacro ' + UI.icon('arrow-right') + '</span>' +
      '</a>' +
      '<a class="mode-card" href="#/banco" data-tone="blue">' +
        '<span class="mode-icon">' + UI.icon('book') + '</span>' +
        '<h3>Banco de estudio</h3>' +
        '<p>Consulta las 200 preguntas con sus alternativas, la clave y el registro de tus intentos.</p>' +
        '<div class="mode-meta"><span>Buscador</span><span>Modo estudio</span></div>' +
        '<span class="mode-link">Explorar el banco ' + UI.icon('arrow-right') + '</span>' +
      '</a>' +
    '</div>';
  }

  function statsStrip(summary) {
    const cards = [
      { label: 'Dominadas', icon: 'check-circle', value: summary.mastered, unit: '/ 200', sub: 'Con 2 aciertos consecutivos' },
      { label: 'Precisión', icon: 'target', value: summary.accuracy + '%', sub: summary.attempts + ' respuestas registradas' },
      { label: 'Racha', icon: 'zap', value: summary.streakDays, unit: summary.streakDays === 1 ? 'día' : 'días', sub: 'Días consecutivos de estudio' },
      { label: 'Simulacros', icon: 'award', value: summary.sessions, sub: summary.sessions ? 'Promedio ' + summary.avgScore.toFixed(1) + ' / 20' : 'Aún sin simulacros' }
    ];
    return '<div class="stat-grid">' + cards.map((card) =>
      '<div class="stat-card">' +
        '<div class="stat-label">' + UI.icon(card.icon) + UI.esc(card.label) + '</div>' +
        '<div class="stat-value">' + UI.esc(String(card.value)) +
          (card.unit ? ' <small>' + UI.esc(card.unit) + '</small>' : '') + '</div>' +
        '<div class="stat-sub">' + UI.esc(card.sub) + '</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  function resumeBanner(active) {
    const answered = Object.keys(active.answers || {}).length;
    const total = (active.questionIds || []).length;
    let timeLabel = 'Sin límite de tiempo';
    if (active.endsAt) {
      const remaining = Math.max(0, Math.round((active.endsAt - Date.now()) / 1000));
      timeLabel = remaining > 0 ? 'Quedan ' + UI.fmtClock(remaining) : 'Tiempo agotado';
    }
    const modeLabel = active.mode === 'exam' ? 'Simulacro en curso' : 'Práctica en curso';
    return '<div class="resume-banner">' +
      '<span class="resume-icon">' + UI.icon('play') + '</span>' +
      '<div><strong>' + modeLabel + '</strong><span>' + answered + ' de ' + total + ' respondidas · ' + timeLabel + '</span></div>' +
      '<a class="btn btn-primary btn-sm" href="#/sesion">Continuar ' + UI.icon('arrow-right') + '</a>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="discard-active">Descartar</button>' +
    '</div>';
  }

  function weakSection() {
    const weak = Bank.weak(4);
    if (!weak.length) {
      return '<section class="section">' +
        '<div class="section-head"><div><h2>Tu punto de partida</h2><p>Así funciona la plataforma en tres pasos.</p></div></div>' +
        '<div class="mode-grid">' +
          '<div class="mode-card"><span class="mode-icon">' + UI.icon('target') + '</span><h3>1 · Configura</h3><p>Elige cuántas preguntas resolver, el tiempo y si quieres corrección inmediata o al final.</p></div>' +
          '<div class="mode-card"><span class="mode-icon">' + UI.icon('timer') + '</span><h3>2 · Resuelve</h3><p>Practica con las preguntas del banco. Tus respuestas se guardan automáticamente en este dispositivo.</p></div>' +
          '<div class="mode-card"><span class="mode-icon">' + UI.icon('chart') + '</span><h3>3 · Repasa</h3><p>Revisa la clave, identifica tus errores y vuelve sobre las preguntas que más te cuestan.</p></div>' +
        '</div>' +
      '</section>';
    }
    return '<section class="section">' +
      '<div class="section-head">' +
        '<div><h2>Preguntas que más fallas</h2><p>Prioriza el repaso donde tu precisión es menor.</p></div>' +
        '<a class="section-link" href="#/progreso">Ver progreso ' + UI.icon('arrow-right') + '</a>' +
      '</div>' +
      '<div class="card card-pad"><div class="weak-list">' +
        weak.map((item) =>
          '<a class="weak-row" href="#/banco?q=' + item.question.id + '">' +
            '<span class="weak-num">' + item.question.number + '</span>' +
            '<span class="weak-text">' + UI.esc(item.question.text) + '</span>' +
            '<span class="bar bar--thin bar--amber"><i style="width:' + item.accuracy + '%"></i></span>' +
            '<span class="weak-pct">' + item.accuracy + '%</span>' +
          '</a>'
        ).join('') +
      '</div></div>' +
    '</section>';
  }

  const Home = {
    render(root) {
      const summary = Store.summary();
      const counts = Bank.counts();
      const active = Store.get().active;
      const meta = Bank.meta() || { total: 200 };
      const coverage = counts.all ? Math.round((summary.answeredUnique / counts.all) * 100) : 0;
      const masteredPct = counts.all ? Math.round((summary.mastered / counts.all) * 100) : 0;

      root.innerHTML =
        '<div class="hero">' +
          '<div class="hero-copy">' +
            '<span class="eyebrow">Banco de 200 preguntas · Ascensos 2026</span>' +
            '<h1>Domina el banco.<br><span class="accent">Llega seguro.</span></h1>' +
            '<p class="lead">Practica con las 200 preguntas del balotario, simula el examen con tiempo real y repasa cada error con la clave del documento. Todo tu avance queda guardado en este dispositivo.</p>' +
            '<div class="hero-actions">' +
              '<a class="btn btn-primary btn-lg" href="#/simulacro">' + UI.icon('play') + ' Iniciar simulacro</a>' +
              '<a class="btn btn-ghost btn-lg" href="#/practicar">' + UI.icon('target') + ' Practicar ahora</a>' +
            '</div>' +
            '<ul class="hero-trust">' +
              '<li>' + UI.icon('check') + ' 200 preguntas verificadas</li>' +
              '<li>' + UI.icon('check') + ' 4 alternativas por pregunta</li>' +
              '<li>' + UI.icon('check') + ' Clave contrastada 200/200</li>' +
              '<li>' + UI.icon('check') + ' Progreso 100% local</li>' +
            '</ul>' +
          '</div>' +
          '<aside class="hero-panel" aria-label="Resumen del banco y tu avance">' +
            '<div class="hero-panel-top">' +
              '<span class="pill pill-live"><span class="dot"></span> Fuente verificada</span>' +
              '<span class="hero-panel-meta">PDF · 40 págs.</span>' +
            '</div>' +
            '<div class="hero-count">' +
              '<span class="hero-count-num">' + meta.total + '</span>' +
              '<span class="hero-count-copy"><strong>preguntas</strong><span>con alternativa única verificada</span></span>' +
            '</div>' +
            '<ul class="hero-facts">' +
              '<li>' + UI.icon('check') + ' Numeración y redacción originales</li>' +
              '<li>' + UI.icon('check') + ' Respuestas de la hoja de clave</li>' +
              '<li>' + UI.icon('check') + ' Sin preguntas inventadas ni completadas</li>' +
            '</ul>' +
            '<div class="hero-progress">' +
              '<div class="row"><span>Tu avance · dominadas</span><strong>' + summary.mastered + ' / ' + counts.all + '</strong></div>' +
              '<div class="bar"><i style="width:' + masteredPct + '%"></i></div>' +
              '<div class="row" style="margin-top:10px;margin-bottom:0"><span>Cobertura del banco</span><strong>' + coverage + '%</strong></div>' +
            '</div>' +
            '<span class="hero-seal" aria-hidden="true">CLAVE<br>VERIFICADA<br>200/200</span>' +
          '</aside>' +
        '</div>' +

        (active ? resumeBanner(active) : '') +

        '<section class="section">' +
          '<div class="section-head">' +
            '<div><h2>Elige cómo prepararte</h2><p>Tres formas de trabajar el mismo banco, sin alterar su contenido.</p></div>' +
            '<a class="section-link" href="#/banco">Ver las 200 preguntas ' + UI.icon('arrow-right') + '</a>' +
          '</div>' +
          modeCards() +
        '</section>' +

        '<section class="section">' +
          '<div class="section-head">' +
            '<div><h2>Tu progreso</h2><p>Métricas calculadas con tus respuestas en este navegador.</p></div>' +
            '<a class="section-link" href="#/progreso">Abrir estadísticas ' + UI.icon('arrow-right') + '</a>' +
          '</div>' +
          statsStrip(summary) +
        '</section>' +

        weakSection() +

        '<section class="section">' +
          '<div class="source-banner">' +
            '<span class="source-icon">' + UI.icon('shield') + '</span>' +
            '<div>' +
              '<h3>Contenido fiel al documento fuente</h3>' +
              '<p>Las 200 preguntas, sus alternativas y la relación de respuestas se extrajeron del PDF y se contrastaron con dos motores de lectura. No se corrigió, completó ni reinterpretó ningún enunciado.</p>' +
            '</div>' +
            '<a class="btn btn-outline btn-sm" href="#/ajustes">Ver detalles</a>' +
          '</div>' +
        '</section>';

      const discard = root.querySelector('[data-action="discard-active"]');
      if (discard) {
        discard.addEventListener('click', async () => {
          const ok = await UI.confirm({
            title: '¿Descartar la sesión en curso?',
            message: 'Se perderán las respuestas de esta sesión. El progreso de sesiones anteriores se conserva.',
            confirmLabel: 'Descartar sesión',
            danger: true
          });
          if (ok) {
            Store.clearActive();
            UI.toast('Sesión descartada.', 'info');
            window.Router.render();
          }
        });
      }
    }
  };

  window.HomeView = Home;
})();
