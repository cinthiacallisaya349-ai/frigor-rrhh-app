require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const db = require("./src/db");
const auth = require("./src/auth");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

// --- Login / logout (sin exigir sesión todavía) ---------------------------

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (
    typeof password === "string" &&
    password.length > 0 &&
    password === process.env.APP_PASSWORD
  ) {
    auth.setSessionCookie(res);
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: "Clave incorrecta" });
});

app.post("/api/logout", (req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/whoami", (req, res) => {
  res.json({ authenticated: auth.isAuthenticated(req) });
});

// La página de login es la única página servida sin exigir sesión.
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

// --- A partir de aquí, todo exige sesión válida ----------------------------

const MODULES = new Set(["organigramas", "perfiles"]);

app.get("/api/state/:module", auth.requireApiAuth, async (req, res) => {
  const { module: moduleName } = req.params;
  if (!MODULES.has(moduleName)) {
    return res.status(404).json({ error: "Módulo desconocido" });
  }
  try {
    const data = await db.getState(moduleName);
    res.json(data);
  } catch (err) {
    console.error("Error leyendo estado:", err);
    res.status(500).json({ error: "Error leyendo la base de datos" });
  }
});

app.put("/api/state/:module", auth.requireApiAuth, async (req, res) => {
  const { module: moduleName } = req.params;
  if (!MODULES.has(moduleName)) {
    return res.status(404).json({ error: "Módulo desconocido" });
  }
  try {
    await db.setState(moduleName, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    console.error("Error guardando estado:", err);
    res.status(500).json({ error: "Error guardando en la base de datos" });
  }
});

// Páginas y archivos estáticos (HTML/JS de las dos herramientas): todo
// detrás del mismo candado de sesión.
app.use(auth.requirePageAuth, express.static(PUBLIC_DIR));

const PORT = process.env.PORT || 3000;

db.ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Frigor RRHH app escuchando en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("No se pudo preparar la base de datos:", err);
    process.exit(1);
  });
