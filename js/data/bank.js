/* ============================================================
   bank.js — carga, validación y consultas del banco de preguntas
   ============================================================ */
(function () {
  'use strict';

  let data = null;
  let byId = new Map();
  let loaded = false;

  async function load() {
    if (loaded) return data;
    let json = null;

    if (window.location.protocol !== 'file:') {
      try {
        const response = await fetch('data/questions.json', { cache: 'no-cache' });
        if (response.ok) json = await response.json();
      } catch (err) {
        // Se usa el respaldo embebido (data/questions.js).
      }
    }
    if (!json && window.QUESTION_BANK) json = window.QUESTION_BANK;
    if (!json) throw new Error('No se encontró el banco de preguntas.');

    const check = validate(json);
    if (!check.ok) {
      throw new Error('El banco de preguntas no pasó la validación: ' + check.errors.join(' · '));
    }

    data = json;
    byId = new Map(json.questions.map((q) => [q.id, q]));
    loaded = true;
    return data;
  }

  function validate(json) {
    const errors = [];
    if (!json || typeof json !== 'object') return { ok: false, errors: ['El archivo no es un objeto válido.'] };
    const list = Array.isArray(json.questions) ? json.questions : [];
    if (list.length !== 200) errors.push('Se esperaban 200 preguntas y se encontraron ' + list.length + '.');
    const seen = new Set();
    list.forEach((q, index) => {
      const label = 'Pregunta ' + (q && q.number != null ? q.number : '#' + (index + 1));
      if (!q || typeof q !== 'object') { errors.push(label + ': registro inválido.'); return; }
      if (!Number.isInteger(q.id) || q.id < 1 || q.id > 200) errors.push(label + ': id inválido.');
      if (q.number !== q.id) errors.push(label + ': numeración inconsistente.');
      if (seen.has(q.id)) errors.push(label + ': id duplicado.');
      seen.add(q.id);
      if (!q.text || !String(q.text).trim()) errors.push(label + ': enunciado vacío.');
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(label + ': debe tener 4 alternativas.');
      } else {
        const letters = q.options.map((o) => o.letter).join('');
        if (letters !== 'ABCD') errors.push(label + ': las alternativas deben ser A, B, C y D en orden.');
        q.options.forEach((o) => {
          if (!o || !String(o.text || '').trim()) errors.push(label + ': alternativa ' + (o && o.letter) + ' vacía.');
        });
      }
      if (!q.answer || 'ABCD'.indexOf(q.answer) === -1) errors.push(label + ': respuesta correcta inválida.');
      else if (!q.options.some((o) => o.letter === q.answer)) errors.push(label + ': la respuesta no coincide con ninguna alternativa.');
    });
    for (let i = 1; i <= 200; i++) if (!seen.has(i)) errors.push('Falta la pregunta ' + i + '.');
    if (json.meta && json.meta.total !== 200) errors.push('La metadata no declara 200 preguntas.');
    return { ok: errors.length === 0, errors };
  }

  function all() {
    if (!data) return [];
    return data.questions;
  }

  function get(id) {
    return byId.get(Number(id)) || null;
  }

  function count() { return data ? data.questions.length : 0; }

  function statusOf(id) { return window.Store.statusFor(id); }

  function progressOf(id) { return window.Store.progressFor(id); }

  function matchesScope(id, scope) {
    if (scope === 'new') return window.Store.statusFor(id) === 'new';
    if (scope === 'failed') return window.Store.progressFor(id).lastCorrect === false;
    if (scope === 'unmastered') return window.Store.statusFor(id) !== 'mastered';
    if (scope === 'studied') return Boolean(window.Store.progressFor(id).studyAt);
    return true;
  }

  function pool(scope) {
    return all().filter((q) => matchesScope(q.id, scope || 'all')).map((q) => q.id);
  }

  function counts() {
    const out = { all: all().length, new: 0, learning: 0, mastered: 0, unmastered: 0, failed: 0, studied: 0 };
    all().forEach((q) => {
      const status = window.Store.statusFor(q.id);
      const p = window.Store.progressFor(q.id);
      out[status] += 1;
      if (status !== 'mastered') out.unmastered += 1;
      if (p.lastCorrect === false) out.failed += 1;
      if (p.studyAt) out.studied += 1;
    });
    return out;
  }

  function filtered(options) {
    const opts = options || {};
    const query = window.UI.norm(opts.query || '');
    const scope = opts.scope || 'all';
    const sort = opts.sort || 'number';
    let list = all().filter((q) => matchesScope(q.id, scope));

    if (query) {
      list = list.filter((q) => {
        if (String(q.number) === query) return true;
        if (window.UI.norm(q.text).indexOf(query) !== -1) return true;
        return q.options.some((o) => window.UI.norm(o.text).indexOf(query) !== -1);
      });
    }

    if (sort === 'number-desc') {
      list = list.slice().sort((a, b) => b.number - a.number);
    } else if (sort === 'weak') {
      list = list.slice().sort((a, b) => {
        const pa = window.Store.progressFor(a.id);
        const pb = window.Store.progressFor(b.id);
        const accA = pa.attempts ? pa.correct / pa.attempts : 2;
        const accB = pb.attempts ? pb.correct / pb.attempts : 2;
        return accA - accB || (pb.wrong || 0) - (pa.wrong || 0) || a.number - b.number;
      });
    } else if (sort === 'recent') {
      list = list.slice().sort((a, b) => {
        const da = window.Store.progressFor(a.id).lastAt || '';
        const db = window.Store.progressFor(b.id).lastAt || '';
        return db.localeCompare(da) || a.number - b.number;
      });
    }
    return list;
  }

  function weak(limit) {
    const list = all()
      .filter((q) => {
        const p = window.Store.progressFor(q.id);
        return p.attempts > 0 && (p.lastCorrect === false || (p.correct / p.attempts) < 0.75);
      })
      .map((q) => {
        const p = window.Store.progressFor(q.id);
        return {
          question: q,
          progress: p,
          accuracy: Math.round((p.correct / p.attempts) * 100)
        };
      })
      .sort((a, b) => a.accuracy - b.accuracy || b.progress.wrong - a.progress.wrong);
    return limit ? list.slice(0, limit) : list;
  }

  function answerText(q) {
    if (!q) return '';
    const option = q.options.find((o) => o.letter === q.answer);
    return option ? option.text : '';
  }

  function meta() { return data ? data.meta : null; }

  window.Bank = {
    load,
    validate,
    all,
    get,
    count,
    statusOf,
    progressOf,
    pool,
    counts,
    filtered,
    weak,
    answerText,
    meta,
    isLoaded: () => loaded
  };
})();
