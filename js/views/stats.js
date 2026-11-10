/* ============================================================
   views/stats.js — estadísticas y progreso detallado
   ============================================================ */
(function () {
  'use strict';

  const UI = window.UI;
  const Store = window.Store;
  const Bank = window.Bank;

  function kpiCards(summary, counts) {
    const coverage = counts.all ? Math.round((summary.answeredUnique / counts.all) * 100) : 0;
    const cards = [
      {
        label: 'Cobertura',
        icon: 'book',
        value: coverage + '%',
        sub: summary.answeredUnique + ' de ' + counts.all + ' preguntas intentadas'
      },
      {
        label: 'Precisión',
        icon: 'target',
        value: summary.accuracy + '%',
        sub: summary.correct + ' aciertos de ' + summary.attempts + ' respuestas'
      },
      {
        label: 'Dominadas',
        icon: 'check-circle',
        value: summary.mastered,
        unit: '/ ' + counts.all,
        sub: 'Con 2 aciertos consecutivos'
      },
      {
        label: 'Racha',
        icon: 'zap',
        value: summary.streakDays,
        unit: UI.plural(summary.streakDays, 'día', 'días'),
        sub: summary.sessions + ' ' + UI.plural(summary.sessions, 'sesión completada', 'sesiones completadas')
      }
    ];

    return '<div class="kpi-grid">' + cards.map((card) =>
      '<div class="stat-card">' +
        '<div class="stat-label">' + UI.icon(card.icon) + UI.esc(card.label) + '</div>' +
        '<div class="stat-value">' + UI.esc(String(card.value)) +
          (card.unit ? ' <small>' + UI.esc(card.unit) + '</small>' : '') + '</div>' +
        '<div class="stat-sub">' + UI.esc(card.sub) + '</div>' +
      '</div>'
    ).join('') + '</div>';
  }

  function coverageDonut(counts) {
    const total = counts.all || 200;
    const c = 2 * Math.PI * 62;
    const masteredLen = (counts.mastered / total) * c;
    const learningLen = (counts.learning / total) * c;
    const masteredPct = Math.round((counts.mastered / total) * 100);

    return '<section class="panel">' +
      '<div class="panel-head"><h3>Cobertura del banco</h3><span class="tiny muted">' + total + ' preguntas</span></div>' +
      '<div class="panel-body">' +
        '<div class="donut-wrap">' +
          '<div class="donut">' +
            '<svg viewBox="0 0 148 148" aria-hidden="true">' +
              '<circle class="track" cx="74" cy="74" r="62"></circle>' +
              '<circle class="seg-mastered" cx="74" cy="74" r="62" ' +
                'stroke-dasharray="' + masteredLen.toFixed(2) + ' ' + c.toFixed(2) + '" stroke-dashoffset="0"></circle>' +
              '<circle class="seg-learning" cx="74" cy="74" r="62" ' +
                'stroke-dasharray="' + learningLen.toFixed(2) + ' ' + c.toFixed(2) + '" ' +
                'stroke-dashoffset="' + (-masteredLen).toFixed(2) + '"></circle>' +
            '</svg>' +
            '<div class="donut-center"><strong>' + masteredPct + '%</strong><span>dominadas</span></div>' +
          '</div>' +
          '<div class="donut-legend">' +
            '<div><i class="mastered"></i>Dominadas<strong>' + counts.mastered + '</strong></div>' +
            '<div><i class="learning"></i>En progreso<strong>' + counts.learning + '</strong></div>' +
            '<div><i class="new"></i>Sin empezar<strong>' + counts.new + '</strong></div>' +
          '</div>' +
        '</div>' +
        '<p class="about-note" style="margin-top:18px">Una pregunta se considera dominada tras dos respuestas correctas consecutivas. Las respuestas en blanco no cuentan como intento.</p>' +
      '</div>' +
    '</section>';
  }

  function lastSessionsChart(passScore) {
    const sessions = Store.get().sessions
      .filter((item) => item && item.finishedAt)
      .slice(-12);

    if (!sessions.length) {
      return '<section class="panel">' +
        '<div class="panel-head"><h3>Últimas sesiones</h3></div>' +
        '<div class="panel-body">' +
          '<div class="chart-empty">' + UI.icon('chart') + '<p style="margin-top:8px">Completa tu primera práctica o simulacro para ver aquí la evolución de tus notas.</p></div>' +
        '</div>' +
      '</section>';
    }

    const summaryLabel = sessions.map((s) => {
      const d = new Date(s.finishedAt);
      return d.getDate() + '/' + (d.getMonth() + 1) + ': ' + (Number(s.score20) || 0).toFixed(1) + ' de 20';
    }).join('; ');

    const bars = sessions.map((session) => {
      const score = Number(session.score20) || 0;
      const height = Math.max(4, Math.round((score / 20) * 100));
      const d = new Date(session.finishedAt);
      const label = d.getDate() + '/' + (d.getMonth() + 1);
      const passed = score >= passScore;
      return '<div class="bar-col' + (passed ? ' is-pass' : '') + '" ' +
        'title="' + UI.esc(UI.fmtDate(session.finishedAt) + ' · ' + score.toFixed(1) + ' / 20') + '">' +
        '<span class="bar-track"><span class="bar-fill" style="height:' + height + '%"></span></span>' +
        '<span class="bar-label">' + label + '</span>' +
      '</div>';
    }).join('');

    return '<section class="panel">' +
      '<div class="panel-head"><h3>Últimas sesiones</h3><span class="tiny muted">Nota /20 · ' + sessions.length + ' más recientes</span></div>' +
      '<div class="panel-body">' +
        '<div class="chart-bars" role="img" aria-label="Notas de las últimas ' + sessions.length + ' sesiones. ' + UI.esc(summaryLabel) + '">' +
          bars +
        '</div>' +
        '<p class="about-note" style="margin-top:12px">Las barras verdes alcanzan o superan la nota de referencia configurada (' + passScore.toFixed(1) + ' / 20).</p>' +
      '</div>' +
    '</section>';
  }

  function activityHeatmap() {
    const activity = Store.get().activity || {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = UI.dateKey(today);

    const monday = new Date(today);
    const offset = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - offset);
    const start = new Date(monday);
    start.setDate(start.getDate() - 49);

    const cells = [];
    for (let i = 0; i < 56; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = UI.dateKey(day);
      const future = key > todayKey;
      const record = activity[key];
      const answered = record ? (record.answered || 0) : 0;
      let level = 0;
      if (answered > 0) level = 1;
      if (answered >= 10) level = 2;
      if (answered >= 25) level = 3;
      if (answered >= 50) level = 4;

      const label = UI.fmtDate(day.toISOString(), { weekday: 'short', day: '2-digit', month: 'short' }) +
        (answered ? ' · ' + answered + ' ' + UI.plural(answered, 'respuesta', 'respuestas') : ' · sin actividad');
      cells.push('<span class="heat-cell' + (future ? ' is-future' : '') + '" data-level="' + level + '" ' +
        'title="' + UI.esc(label) + '" aria-hidden="true"></span>');
    }

    const rangeStart = UI.fmtDate(start.toISOString(), { day: '2-digit', month: 'short' });
    const rangeEnd = UI.fmtDate(today.toISOString(), { day: '2-digit', month: 'short', year: 'numeric' });

    return '<section class="panel">' +
      '<div class="panel-head"><h3>Actividad de las últimas 8 semanas</h3><span class="tiny muted">' + rangeStart + ' — ' + rangeEnd + '</span></div>' +
      '<div class="panel-body">' +
        '<div class="heatmap" role="img" aria-label="Mapa de actividad diaria del ' + rangeStart + ' al ' + rangeEnd + '">' +
          cells.join('') +
        '</div>' +
        '<div class="heat-legend">Menos <span class="heat-cell" data-level="0"></span>' +
          '<span class="heat-cell" data-level="1"></span><span class="heat-cell" data-level="2"></span>' +
          '<span class="heat-cell" data-level="3"></span><span class="heat-cell" data-level="4"></span> Más' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function weakPanel() {
    const weak = Bank.weak(8);
    let body;
    if (!weak.length) {
      body = UI.emptyState({
        icon: 'target',
        title: 'Aún no hay preguntas débiles',
        message: 'Cuando respondas preguntas, aquí aparecerán las de menor precisión para que las repases primero.',
        action: '<a class="btn btn-primary btn-sm" href="#/practicar">Practicar ahora</a>'
      });
    } else {
      body = '<div class="weak-table">' + weak.map((item) =>
        '<a class="weak-item" href="#/banco?q=' + item.question.id + '">' +
          '<span class="weak-num">' + item.question.number + '</span>' +
          '<span class="weak-text">' + UI.esc(item.question.text) + '</span>' +
          '<span class="bar bar--thin bar--amber"><i style="width:' + item.accuracy + '%"></i></span>' +
          '<span class="acc ' + UI.accuracyTone(item.accuracy) + '">' + item.accuracy + '%</span>' +
        '</a>'
      ).join('') + '</div>';
    }

    return '<section class="panel">' +
      '<div class="panel-head"><h3>Preguntas que más fallas</h3>' +
        '<a class="section-link" href="#/banco?scope=failed">Ver falladas ' + UI.icon('arrow-right') + '</a>' +
      '</div>' +
      '<div class="panel-body">' + body + '</div>' +
    '</section>';
  }

  function historyPanel() {
    const sessions = Store.get().sessions
      .filter((item) => item && item.finishedAt)
      .slice()
      .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
      .slice(0, 15);

    if (!sessions.length) {
      return '<section class="section">' +
        '<div class="section-head"><div><h2>Historial de sesiones</h2><p>Aquí se guardarán tus prácticas y simulacros completados.</p></div></div>' +
        UI.emptyState({
          icon: 'clock',
          title: 'Sin sesiones completadas',
          message: 'Termina una práctica o un simulacro para registrar tu primera calificación.',
          action: '<a class="btn btn-primary" href="#/simulacro">Iniciar simulacro</a>'
        }) +
      '</section>';
    }

    const rows = sessions.map((session) => {
      const mode = session.mode === 'exam' ? 'Simulacro' : 'Práctica';
      const pill = session.mode === 'exam' ? 'pill-amber' : 'pill-brand';
      const date = UI.fmtDate(session.finishedAt, { day: '2-digit', month: 'short', year: '2-digit' });
      return '<tr>' +
        '<td>' + UI.esc(date) + '</td>' +
        '<td><span class="pill ' + pill + '">' + mode + '</span></td>' +
        '<td class="num">' + (session.total || (session.questionIds || []).length) + '</td>' +
        '<td class="num">' + (session.correct || 0) + '</td>' +
        '<td class="score-cell num">' + (Number(session.score20) || 0).toFixed(1) + ' / 20</td>' +
        '<td class="num">' + UI.fmtClock(session.durationSec || 0) + '</td>' +
        '<td><a href="#/resultados?id=' + encodeURIComponent(session.id) + '">Revisar</a></td>' +
      '</tr>';
    }).join('');

    return '<section class="section">' +
      '<div class="section-head">' +
        '<div><h2>Historial de sesiones</h2><p>Últimas ' + sessions.length + ' sesiones completadas en este dispositivo.</p></div>' +
        '<a class="section-link" href="#/resultados">Ver último resultado ' + UI.icon('arrow-right') + '</a>' +
      '</div>' +
      '<div class="card"><div class="table-wrap">' +
        '<table class="table">' +
          '<caption class="sr-only">Historial de prácticas y simulacros completados</caption>' +
          '<thead><tr>' +
            '<th scope="col">Fecha</th><th scope="col">Modo</th><th scope="col">Preguntas</th>' +
            '<th scope="col">Aciertos</th><th scope="col">Nota</th><th scope="col">Tiempo</th><th scope="col"><span class="sr-only">Acciones</span></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div></div>' +
    '</section>';
  }

  const StatsView = {
    render(root) {
      const summary = Store.summary();
      const counts = Bank.counts();
      const passScore = Store.settings().passScore;
      const active = Store.get().active;

      root.innerHTML =
        UI.pageHead({
          eyebrow: 'Tu progreso',
          title: 'Estadísticas',
          lead: 'Lee tu avance sobre las 200 preguntas del banco: cobertura, precisión, dominio, actividad diaria e historial de sesiones. Todos los datos se calculan y guardan en este navegador.',
          actions: '<a class="btn btn-primary btn-sm" href="#/practicar">' + UI.icon('target') + ' Practicar</a>' +
            '<a class="btn btn-ghost btn-sm" href="#/simulacro">' + UI.icon('timer') + ' Simulacro</a>'
        }) +
        (active
          ? '<div class="resume-banner" style="margin-top:0;margin-bottom:22px">' +
              '<span class="resume-icon">' + UI.icon('play') + '</span>' +
              '<div><strong>Sesión sin terminar</strong><span>' + Object.keys(active.answers || {}).length + ' de ' + (active.questionIds || []).length + ' respondidas</span></div>' +
              '<a class="btn btn-primary btn-sm" href="#/sesion">Continuar</a>' +
            '</div>'
          : '') +
        kpiCards(summary, counts) +
        '<div class="progress-grid">' +
          lastSessionsChart(passScore) +
          coverageDonut(counts) +
        '</div>' +
        '<div class="section" style="margin-top:18px">' + activityHeatmap() + '</div>' +
        '<div class="section" style="margin-top:18px">' + weakPanel() + '</div>' +
        historyPanel();
    }
  };

  window.StatsView = StatsView;
})();
