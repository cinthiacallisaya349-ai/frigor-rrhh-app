# FRIGOR RRHH App

App interna de Talento Humano de FRIGOR. Reúne dos herramientas que antes eran
archivos HTML sueltos (guardaban todo en el navegador de cada persona) en una
sola app web con una base de datos compartida:

- **Organigramas** (`/organigramas/`) — estructura jerárquica por cargo,
  vista vertical y lineal, personigrama por área/sección y nivel.
- **Perfiles de Cargo** (`/perfiles/`) — diseño de perfiles, manual de
  competencias y evaluación curricular de candidatos.

## Cómo funciona (resumen técnico)

Las dos herramientas son, puertas adentro, exactamente el mismo código HTML
que ya existía (ver `public/organigramas/index.html` y
`public/perfiles/index.html`) — casi sin tocar su lógica interna. Ambas
estaban hechas para leer/escribir su estado en `localStorage` del navegador.

En vez de reescribirlas, se les inyectó un único script puente
(`public/sync.js`) que:

1. Al cargar la página, trae el estado guardado en el servidor y lo precarga
   en `localStorage` (vía una petición síncrona), ANTES de que el script
   original de la herramienta arranque. Para la herramienta, es exactamente
   como si ese dato ya hubiera estado en el navegador.
2. Parchea `localStorage.setItem` para que, además de guardar localmente,
   mande (con un pequeño debounce) el contenido actualizado al servidor.

Esto significa que **no hace falta mantener dos copias del código** de cada
herramienta: el archivo en `public/` es, salvo esas líneas agregadas al
principio/final, el mismo HTML de siempre.

El servidor (`server.js`, Express) expone:

- `POST /api/login` / `POST /api/logout` — clave única compartida
  (`APP_PASSWORD`), sesión por cookie firmada (ver `src/auth.js`).
- `GET /api/state/:module` / `PUT /api/state/:module` — lee/graba el estado
  de un módulo (`organigramas` | `perfiles`) como un bloque JSON en Postgres
  (tabla `app_state`, ver `src/db.js`). La tabla se crea sola al arrancar.
- Todo lo demás (las páginas) queda detrás del mismo candado de sesión.

## Desarrollo local

```bash
cp .env.example .env   # y completar APP_PASSWORD / SESSION_SECRET / DATABASE_URL
npm install
npm start
```

Necesita una base Postgres accesible en `DATABASE_URL`.

## Variables de entorno (se configuran en Railway, no en el repo)

| Variable         | Para qué sirve                                              |
|------------------|--------------------------------------------------------------|
| `APP_PASSWORD`   | Clave única para entrar a la app (la comparte toda el área). |
| `SESSION_SECRET` | Texto secreto para firmar la cookie de sesión.                |
| `DATABASE_URL`   | Cadena de conexión a Postgres (Railway la genera sola).       |
| `PORT`           | Puerto HTTP (Railway la define sola).                         |

## Primera carga de datos

La base arranca vacía. Para cargar los datos reales existentes, entrar a cada
módulo ya publicado y usar su botón de **"Importar"** de siempre con el
archivo `.json` correspondiente (el mismo que ya se usaba para pasar datos
entre navegadores). Una vez importado, queda en la base compartida para
todos.
