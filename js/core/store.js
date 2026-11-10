/* ============================================================
   store.js — estado, persistencia y progreso
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'cgbvp.prep.v1';
  const VERSION = 1;
  const MAX_SESSIONS = 40;

  let state = null;
  let persistent = true;

  function nowISO() { return new Date().toISOString(); }

  function defaults() {
    return {
      version: VERSION,
      settings: {
        theme: 'dark',
        textLarge: false,
        passScore: 14,
        instantFeedback: true,
        sound: false
      },
      progress: {},
      sessions: [],
      active: null,
      lastSessionId: null,
      activity: {},
      meta: { createdAt: nowISO(), updatedAt: nowISO() }
    };
  }

  function sanitizeSettings(input) {
    const src = input && typeof input === 'object' ? input : {};
    const out = {};
    if (['dark', 'light', 'system'].indexOf(src.theme) !== -1) out.theme = src.theme;
    if (typeof src.textLarge === 'boolean') out.textLarge = src.textLarge;
    if (typeof src.instantFeedback === 'boolean') out.instantFeedback = src.instantFeedback;
    if (typeof src.sound === 'boolean') out.sound = src.sound;
    if (src.passScore != null) {
      const n = Number(src.passScore);
      if (isFinite(n)) out.passScore = Math.min(20, Math.max(0, Math.round(n * 10) / 10));
    }
    return out;
  }

  function merge(input) {
    const base = defaults();
    if (!input || typeof input !== 'object') return base;
    base.settings = Object.assign(base.settings, sanitizeSettings(input.settings));
    base.progress = input.progress && typeof input.progress === 'object' ? input.progress : {};
    base.sessions = Array.isArray(input.sessions) ? input.sessions.slice(-MAX_SESSIONS) : [];
    base.active = input.active && typeof input.active === 'object' ? input.active : null;
    base.lastSessionId = typeof input.lastSessionId === 'string' ? input.lastSessionId : null;
    base.activity = input.activity && typeof input.activity === 'object' ? input.activity : {};
    if (input.meta && typeof input.meta === 'object') {
      base.meta = Object.assign(base.meta, input.meta);
    }
    return base;
  }

  function load() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (err) {
      persistent = false;
    }
    if (!raw) {
      state = defaults();
      return state;
    }
    try {
      state = merge(JSON.parse(raw));
    } catch (err) {
      state = defaults();
      persistent = false;
    }
    return state;
  }

  function save() {
    state.meta.updatedAt = nowISO();
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
    } catch (err) {
      persistent = false;
    }
  }

  function get() {
    if (!state) load();
    return state;
  }

  function set(mutator) {
    const s = get();
    mutator(s);
    save();
    return s;
  }

  function settings() { return get().settings; }

  function updateSettings(patch) {
    set((s) => {
      Object.assign(s.settings, sanitizeSettings(Object.assign({}, s.settings, patch)));
    });
    return get().settings;
  }

  function emptyProgress() {
    return {
      attempts: 0,
      correct: 0,
      wrong: 0,
      streak: 0,
      bestStreak: 0,
      lastCorrect: null,
      lastChoice: null,
      lastAt: null,
      studyKnown: 0,
      studyUnknown: 0,
      studyAt: null
    };
  }

  function progressFor(id) {
    const p = get().progress[id];
    return p ? Object.assign(emptyProgress(), p) : emptyProgress();
  }

  function statusFor(id) {
    const p = get().progress[id];
    if (!p || !p.attempts) return 'new';
    if ((p.streak || 0) >= 2) return 'mastered';
    return 'learning';
  }

  function accuracyFor(id) {
    const p = get().progress[id];
    if (!p || !p.attempts) return null;
    return Math.round(((p.correct || 0) / p.attempts) * 100);
  }

  function startSession(session) {
    set((s) => { s.active = session; });
    return session;
  }

  function updateActive(patch) {
    const s = get();
    if (!s.active) return null;
    Object.assign(s.active, patch);
    save();
    return s.active;
  }

  function clearActive() {
    set((s) => { s.active = null; });
  }

  function completeSession(result) {
    set((s) => {
      if (s.sessions.some((item) => item.id === result.id)) {
        s.active = null;
        return;
      }
      const at = result.finishedAt || nowISO();
      const day = window.UI.dateKey(new Date(at));

      Object.keys(result.checks || {}).forEach((qid) => {
        const check = result.checks[qid];
        if (check === 'blank') return;
        const p = s.progress[qid] || emptyProgress();
        p.attempts = (p.attempts || 0) + 1;
        p.lastAt = at;
        p.lastChoice = (result.answers && result.answers[qid]) || null;
        if (check === 'correct') {
          p.correct = (p.correct || 0) + 1;
          p.streak = (p.streak || 0) + 1;
          p.lastCorrect = true;
          p.bestStreak = Math.max(p.bestStreak || 0, p.streak);
        } else {
          p.wrong = (p.wrong || 0) + 1;
          p.streak = 0;
          p.lastCorrect = false;
        }
        s.progress[qid] = p;
      });

      if (!s.activity[day]) s.activity[day] = { answered: 0, correct: 0, sessions: 0 };
      s.activity[day].answered += result.answered || 0;
      s.activity[day].correct += result.correct || 0;
      s.activity[day].sessions += 1;

      s.sessions.push(result);
      if (s.sessions.length > MAX_SESSIONS) {
        s.sessions = s.sessions.slice(-MAX_SESSIONS);
      }
      s.lastSessionId = result.id;
      s.active = null;
    });
    return result;
  }

  function touchStudy(id, known) {
    set((s) => {
      const p = s.progress[id] || emptyProgress();
      if (known) p.studyKnown = (p.studyKnown || 0) + 1;
      else p.studyUnknown = (p.studyUnknown || 0) + 1;
      p.studyAt = nowISO();
      s.progress[id] = p;
    });
  }

  function sessionById(id) {
    return get().sessions.find((item) => item.id === id) || null;
  }

  function lastSession() {
    const s = get();
    return (s.lastSessionId && sessionById(s.lastSessionId)) || s.sessions[s.sessions.length - 1] || null;
  }

  function summary() {
    const s = get();
    let attempts = 0;
    let correct = 0;
    let mastered = 0;
    let learning = 0;
    let studied = 0;
    const ids = Object.keys(s.progress);

    ids.forEach((id) => {
      const p = s.progress[id];
      attempts += p.attempts || 0;
      correct += p.correct || 0;
      if ((p.streak || 0) >= 2) mastered += 1;
      else if ((p.attempts || 0) > 0) learning += 1;
      if (p.studyAt) studied += 1;
    });

    const completed = s.sessions.filter((item) => item && item.finishedAt);
    const avgScore = completed.length
      ? completed.reduce((acc, item) => acc + (Number(item.score20) || 0), 0) / completed.length
      : 0;
    const totalSeconds = completed.reduce((acc, item) => acc + (item.durationSec || 0), 0);

    return {
      answeredUnique: ids.length,
      attempts,
      correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      mastered,
      learning,
      studied,
      sessions: completed.length,
      avgScore: Math.round(avgScore * 10) / 10,
      avgSeconds: attempts ? Math.round(totalSeconds / attempts) : 0,
      streakDays: streakDays(s.activity)
    };
  }

  function streakDays(activity) {
    const keys = Object.keys(activity || {});
    if (!keys.length) return 0;
    const set = new Set(keys.filter((k) => (activity[k].answered || 0) > 0 || (activity[k].sessions || 0) > 0));
    let cursor = new Date();
    if (!set.has(window.UI.dateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!set.has(window.UI.dateKey(cursor))) return 0;
    }
    let streak = 0;
    while (set.has(window.UI.dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function exportData() {
    const copy = JSON.parse(JSON.stringify(get()));
    copy.exportedAt = nowISO();
    copy.app = 'CGBVP-Preparacion-2026';
    return copy;
  }

  function importData(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, error: 'El archivo no contiene un objeto de datos válido.' };
    }
    if (!input.progress && !input.sessions && !input.settings) {
      return { ok: false, error: 'No se reconoce el formato del archivo de progreso.' };
    }
    const imported = merge(input);
    imported.active = null;
    imported.meta = Object.assign(imported.meta, { updatedAt: nowISO() });
    state = imported;
    save();
    return {
      ok: true,
      questions: Object.keys(imported.progress).length,
      sessions: imported.sessions.length
    };
  }

  function reset() {
    state = defaults();
    save();
  }

  function isPersistent() { return persistent; }

  window.Store = {
    KEY,
    load,
    get,
    save,
    settings,
    updateSettings,
    progressFor,
    statusFor,
    accuracyFor,
    startSession,
    updateActive,
    clearActive,
    completeSession,
    touchStudy,
    sessionById,
    lastSession,
    summary,
    exportData,
    importData,
    reset,
    isPersistent,
    emptyProgress
  };
})();
