# CGBVP · Preparación 2026

Plataforma web estática para estudiar, practicar y rendir simulacros cronometrados con las **200 preguntas** del documento `Banco de 200 Preguntas.pdf` (balotario de ascensos 2026 del Cuerpo General de Bomberos Voluntarios del Perú).

> **Proyecto educativo no oficial.** No está afiliado ni respaldado por el CGBVP. Las preguntas, alternativas y respuestas provienen exclusivamente del PDF fuente; no se inventó, corrigió, completó ni reinterpretó ningún contenido. Verifica siempre la normativa vigente y las indicaciones oficiales.

---

## Contenido

- [Características](#características)
- [Cómo usarlo](#cómo-usarlo)
- [Publicación en GitHub Pages](#publicación-en-github-pages)
- [Fidelidad y verificación del banco](#fidelidad-y-verificación-del-banco)
- [Reglas de calificación y progreso](#reglas-de-calificación-y-progreso)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Privacidad y respaldo](#privacidad-y-respaldo)
- [Accesibilidad y diseño](#accesibilidad-y-diseño)
- [Tecnologías](#tecnologías)
- [Limitaciones y aviso](#limitaciones-y-aviso)

---

## Características

### Práctica guiada
- Configuración de cantidad (1–200), tiempo (sin límite o hasta 300 min), alcance y orden.
- Corrección inmediata tras cada respuesta con la clave original del banco.
- Posibilidad de practicar el banco completo, las preguntas sin responder, las falladas o las no dominadas.
- Sesión reanudable: las respuestas se guardan automáticamente.

### Simulacro cronometrado
- Corrección diferida hasta finalizar.
- Cronómetro con calificación automática al agotarse el tiempo.
- Nota vigesimal calculada sobre el total de preguntas de la sesión.
- Navegador de preguntas, marcado de ítems y panel de avance.

### Resultados y revisión
- Nota /20, porcentaje de aciertos, correctas, incorrectas, en blanco, tiempo y ritmo.
- Filtros de revisión: todas, incorrectas, en blanco, correctas y marcadas.
- Clave del banco y alternativa elegida visibles en cada pregunta.
- Repetición de la sesión o práctica focalizada en las preguntas falladas.
- Impresión de la revisión.

### Banco de estudio
- Las 200 preguntas con sus cuatro alternativas y la clave.
- Buscador por enunciado, alternativa o número, insensible a tildes.
- Filtros por estado: sin responder, falladas, no dominadas y estudiadas.
- Orden por número, por más falladas o por última práctica.
- Enlaces profundos a una pregunta concreta (`#/banco?q=37`).
- Acceso directo al modo estudio o a practicar una sola pregunta.

### Modo estudio
- Tarjetas con revelación de la respuesta y autoevaluación («la sabía» / «no la sabía»).
- Filtros por alcance, orden aleatorio y reinicio de ronda.
- La autoevaluación se registra aparte y **no altera** la precisión de examen.

### Progreso
- Cobertura del banco, precisión global, preguntas dominadas y racha de días.
- Gráfico de notas de las últimas 12 sesiones.
- Anillo de cobertura (dominadas / en progreso / sin empezar).
- Mapa de actividad de las últimas 8 semanas.
- Ranking de preguntas más falladas e historial de sesiones con enlace a cada resultado.

### Preferencias
- Tema oscuro, claro o según el sistema.
- Tamaño de texto normal o grande.
- Nota mínima de referencia configurable (por defecto 14 / 20).
- Sonido de respuesta opcional.
- Exportación e importación del progreso en JSON y restablecimiento total.
- Panel de verificación con la fuente, el método de extracción y el estado de la clave.

### Transversal
- Diseño responsive mobile-first con barra de navegación inferior en móvil.
- Atajos de teclado y diálogo de ayuda (`?`).
- Iconografía SVG inline, sin dependencias externas.
- Funciona sin conexión y también abriendo `index.html` con doble clic.

---

## Cómo usarlo

No requiere instalación, compilación ni backend.

### Opción A — abrir directamente

1. Descarga o clona la carpeta del proyecto.
2. Abre `index.html` con un navegador moderno (Chrome, Edge, Firefox o Safari).
3. La aplicación carga el banco desde `data/questions.js` cuando `fetch` no está disponible en `file://`.

### Opción B — servidor local (recomendado)

Desde la carpeta del proyecto:

```bash
# Python 3
python -m http.server 8080
```

```bash
# Node.js (sin instalar nada)
npx serve .
```

Luego abre `http://localhost:8080`.

El servidor local permite cargar `data/questions.json` mediante `fetch`; si falla, la aplicación usa automáticamente el respaldo embebido.

### Verificar el banco

```bash
node tools/verify-bank.mjs
```

Comprueba 200 preguntas, 800 alternativas, 200 claves, numeración, páginas y coincidencia entre `data/questions.json` y `data/questions.js`.

---

## Publicación en GitHub Pages

El proyecto es 100 % estático y no necesita build.

1. Crea un repositorio y sube el contenido de esta carpeta a la rama `main`.
2. En GitHub, entra a **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda y espera a que GitHub publique la URL.

La aplicación usa rutas por hash (`#/inicio`, `#/banco`, etc.), por lo que funciona correctamente en cualquier subcarpeta de GitHub Pages sin reglas de reescritura.

> Si el repositorio es `usuario.github.io/repositorio`, la URL final será `https://usuario.github.io/repositorio/`. No es necesario modificar rutas.

---

## Fidelidad y verificación del banco

El contenido se extrajo del PDF y se contrastó con **dos motores independientes**:

| Control | Resultado |
| --- | --- |
| Preguntas | 200 / 200 |
| Alternativas | 800 / 800 (A, B, C y D por pregunta) |
| Claves | 200 / 200 |
| Coincidencia pdf.js vs. MuPDF | 100 % en enunciados, alternativas y clave |
| Páginas de preguntas | 1–40 |
| Hoja de respuestas | Páginas 41 en adelante |
| Preguntas con alternativas precedidas por viñeta | 6 (ítems 118, 121, 130, 177, 181 y 193), tratadas por el parser |

Distribución de la clave: **A = 17, B = 89, C = 73, D = 21**.

Reglas de fidelidad aplicadas:

- Se conserva la redacción original, la numeración, el orden de las alternativas y las letras A–D.
- La clave se toma exclusivamente de la hoja de respuestas del documento.
- No se corrigieron erratas, no se completaron enunciados y no se añadieron preguntas.
- La aleatorización afecta únicamente al **orden de las preguntas**, nunca al orden de las alternativas.
- Cada pregunta conserva su página de origen (`page`) para trazabilidad.

Los metadatos de la extracción están en `data/questions.json` (`meta`) y se muestran en **Ajustes → Fuente y verificación**.

---

## Reglas de calificación y progreso

- **Nota vigesimal:** `aciertos / total de preguntas de la sesión × 20`, redondeada a un decimal.
- **Preguntas en blanco:** no suman aciertos; el denominador es el total de la sesión.
- **Nota de referencia:** 14 / 20 por defecto, tomada del ítem 2 del banco. Es configurable y solo cambia el mensaje de referencia, no la clave ni el cálculo.
- **Dominada:** 2 respuestas correctas consecutivas en sesiones calificadas.
- **En progreso:** al menos un intento registrado y menos de 2 aciertos consecutivos.
- **Nueva:** sin intentos registrados.
- **Precisión:** `aciertos / intentos` (las respuestas en blanco no cuentan como intento).
- **Racha:** días consecutivos con actividad registrada.
- **Autoevaluación de estudio:** se guarda en campos separados (`studyKnown`, `studyUnknown`) y no modifica la precisión de examen.

El historial conserva las últimas 40 sesiones completadas.

---

## Estructura del proyecto

```text
bomberos/
├─ index.html                  Shell de la aplicación, navegación y sprite SVG
├─ manifest.webmanifest        Metadatos PWA
├─ README.md
├─ Banco de 200 Preguntas.pdf  Documento fuente
├─ assets/
│  ├─ fonts/                   Inter y Barlow Condensed (WOFF2 locales)
│  └─ icons/app-icon.svg       Icono de la aplicación
├─ css/
│  ├─ styles.css               Tokens, base, layout, cabecera y pie
│  ├─ components.css           Componentes de interfaz
│  └─ responsive.css           Adaptación a móvil y tablet
├─ data/
│  ├─ questions.json           Banco canónico (200 preguntas)
│  └─ questions.js             Respaldo offline (window.QUESTION_BANK)
├─ js/
│  ├─ core/
│  │  ├─ ui.js                 Utilidades de interfaz, modal, toasts, gauge
│  │  ├─ store.js              Estado, localStorage, progreso y respaldo
│  │  └─ router.js             Enrutado por hash
│  ├─ data/bank.js             Carga, validación y consultas del banco
│  ├─ views/
│  │  ├─ home.js               Inicio
│  │  ├─ practice.js           Configuración de práctica y simulacro
│  │  ├─ quiz.js               Motor de sesión y cronómetro
│  │  ├─ results.js            Resultados y revisión
│  │  ├─ library.js            Banco completo con buscador
│  │  ├─ study.js              Modo estudio
│  │  ├─ stats.js              Estadísticas e historial
│  │  └─ settings.js           Preferencias y datos
│  └─ app.js                   Arranque, rutas, tema y atajos globales
└─ tools/
   └─ verify-bank.mjs          Verificación reproducible del banco
```

---

## Modelo de datos

Cada pregunta de `data/questions.json` tiene esta forma:

```json
{
  "id": 2,
  "number": 2,
  "text": "¿Cuál es la nota mínima aprobatoria requerida tanto para el Promedio Final de Módulo como para la Evaluación Final del curso?",
  "options": [
    { "letter": "A", "text": "12" },
    { "letter": "B", "text": "13" },
    { "letter": "C", "text": "14" },
    { "letter": "D", "text": "15" }
  ],
  "page": 1,
  "answer": "C"
}
```

El progreso se guarda en `localStorage` bajo la clave `cgbvp.prep.v1` con este esquema general:

```text
settings   → tema, tamaño de texto, nota de referencia, sonido
progress   → intentos, aciertos, racha, última respuesta y repaso por pregunta
sessions   → historial de sesiones completadas (máx. 40)
active     → sesión en curso, si existe
activity   → respuestas y sesiones por día
meta       → fechas de creación y actualización
```

---

## Privacidad y respaldo

- No hay backend, base de datos, cuentas ni telemetría.
- Todo el progreso permanece en el navegador del usuario.
- **Ajustes → Datos y respaldo** permite exportar un JSON, importarlo en otro navegador y restablecer todo.
- Si el navegador bloquea `localStorage`, la aplicación lo advierte y el progreso no se conserva al cerrar la página.

---

## Accesibilidad y diseño

- HTML semántico, encabezados jerárquicos y regiones `aria-live` para anuncios.
- Navegación completa por teclado, foco visible y diálogos con trampa de foco.
- Etiquetas accesibles en formularios, navegador de preguntas y controles.
- Contraste cuidado en tema oscuro y claro; soporte de `prefers-reduced-motion`.
- Diseño mobile-first con barra inferior de navegación, objetivos táctiles amplios y layouts fluidos.
- Tipografía local, sin peticiones a CDNs.

---

## Tecnologías

- HTML5, CSS3 y JavaScript ES6+ (scripts clásicos con espacios de nombres globales).
- JSON como formato de datos.
- SVG para toda la iconografía.
- `localStorage` para persistencia.
- Sin React, Vue, Angular, Next.js, backend, base de datos ni claves de API.
- Sin paso de compilación ni dependencias de ejecución.

---

## Limitaciones y aviso

- La plataforma es una herramienta de estudio; no reproduce el examen oficial ni garantiza resultados.
- La nota de referencia es orientativa y configurable; confirma siempre los criterios oficiales vigentes.
- El banco refleja exclusivamente el contenido del PDF entregado. Si el documento fuente se actualiza, los datos deben volver a extraerse y verificarse.
- Proyecto educativo no oficial, sin afiliación ni respaldo del CGBVP.
