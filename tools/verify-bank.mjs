#!/usr/bin/env node
/* ============================================================
   verify-bank.mjs — verificación reproducible del banco
   Uso: node tools/verify-bank.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const jsonPath = resolve(root, 'data/questions.json');
const jsPath = resolve(root, 'data/questions.js');

const errors = [];
const fail = (message) => errors.push(message);

function check(condition, message) {
  if (!condition) fail(message);
}

/* ---------- Carga ---------- */
const bank = JSON.parse(readFileSync(jsonPath, 'utf8'));

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(jsPath, 'utf8'), sandbox, { filename: 'data/questions.js' });
const fallback = sandbox.window.QUESTION_BANK;

check(Boolean(fallback), 'data/questions.js no expone window.QUESTION_BANK.');
if (fallback) {
  check(
    JSON.stringify(bank) === JSON.stringify(fallback),
    'data/questions.json y data/questions.js no coinciden.'
  );
}

/* ---------- Estructura ---------- */
check(Array.isArray(bank.questions), 'El banco no contiene una lista de preguntas.');
const questions = Array.isArray(bank.questions) ? bank.questions : [];
check(questions.length === 200, `Se esperaban 200 preguntas y hay ${questions.length}.`);
check(bank.meta && bank.meta.total === 200, 'meta.total debe ser 200.');
check(bank.meta && bank.meta.optionsPerQuestion === 4, 'meta.optionsPerQuestion debe ser 4.');
check(bank.meta && bank.meta.answerKeyVerified === true, 'meta.answerKeyVerified debe ser true.');

const seenIds = new Set();
const seenNumbers = new Set();
const distribution = { A: 0, B: 0, C: 0, D: 0 };
const pageSet = new Set();
let optionsTotal = 0;

questions.forEach((question, index) => {
  const label = `Pregunta #${index + 1}`;
  if (!question || typeof question !== 'object') {
    fail(`${label}: registro inválido.`);
    return;
  }
  check(Number.isInteger(question.id) && question.id >= 1 && question.id <= 200, `${label}: id inválido.`);
  check(question.number === question.id, `${label}: number no coincide con id.`);
  check(!seenIds.has(question.id), `${label}: id duplicado.`);
  check(!seenNumbers.has(question.number), `${label}: number duplicado.`);
  seenIds.add(question.id);
  seenNumbers.add(question.number);

  check(typeof question.text === 'string' && question.text.trim().length > 0, `${label}: enunciado vacío.`);
  check(Number.isInteger(question.page) && question.page >= 1 && question.page <= 40, `${label}: página fuera de 1–40.`);
  if (Number.isInteger(question.page)) pageSet.add(question.page);

  check(Array.isArray(question.options) && question.options.length === 4, `${label}: debe tener 4 alternativas.`);
  if (Array.isArray(question.options)) {
    optionsTotal += question.options.length;
    const letters = question.options.map((option) => option && option.letter).join('');
    check(letters === 'ABCD', `${label}: las alternativas deben ser A, B, C y D en orden.`);
    question.options.forEach((option) => {
      check(
        option && typeof option.text === 'string' && option.text.trim().length > 0,
        `${label}: alternativa ${option && option.letter} vacía.`
      );
    });
  }

  check(typeof question.answer === 'string' && 'ABCD'.includes(question.answer), `${label}: respuesta inválida.`);
  if (typeof question.answer === 'string' && 'ABCD'.includes(question.answer)) {
    distribution[question.answer] += 1;
    check(
      Array.isArray(question.options) && question.options.some((option) => option && option.letter === question.answer),
      `${label}: la clave no coincide con ninguna alternativa.`
    );
  }
});

for (let id = 1; id <= 200; id += 1) {
  check(seenIds.has(id), `Falta la pregunta ${id}.`);
}

check(optionsTotal === 800, `Se esperaban 800 alternativas y hay ${optionsTotal}.`);
check(pageSet.size === 40, `Se esperaban preguntas distribuidas en 40 páginas y hay ${pageSet.size}.`);

/* ---------- Salida ---------- */
console.log('CGBVP · Verificación del banco de preguntas');
console.log('-------------------------------------------');
console.log(`Preguntas:            ${questions.length} / 200`);
console.log(`Alternativas:         ${optionsTotal} / 800 (4 por pregunta)`);
console.log(`Claves válidas:       ${distribution.A + distribution.B + distribution.C + distribution.D} / 200`);
console.log(`Distribución A/B/C/D: ${distribution.A} / ${distribution.B} / ${distribution.C} / ${distribution.D}`);
console.log(`Páginas cubiertas:    ${pageSet.size} / 40`);
console.log(`Respaldo questions.js: ${fallback ? 'presente y coincidente' : 'ausente'}`);
console.log('');

if (errors.length) {
  console.error(`FALLÓ: ${errors.length} problema(s) encontrado(s).`);
  errors.forEach((message) => console.error(' - ' + message));
  process.exit(1);
}

console.log('OK: el banco es consistente y conserva 200 preguntas, 800 alternativas y 200 claves.');
