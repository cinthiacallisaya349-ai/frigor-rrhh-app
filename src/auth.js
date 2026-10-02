// Acceso con una sola contraseña compartida para toda el área.
// No hay usuarios individuales: quien conoce la clave, entra.
//
// Cómo funciona: al escribir la clave correcta, el servidor entrega una
// "cookie" firmada (una especie de sello que no se puede falsificar sin
// conocer el SESSION_SECRET). El navegador la guarda y la manda en cada
// pedido siguiente; el servidor solo verifica el sello y la fecha de
// vencimiento, sin tener que consultar nada más.

const crypto = require("crypto");

const COOKIE_NAME = "frigor_session";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Falta la variable de entorno SESSION_SECRET.");
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createSessionCookieValue() {
  const expiresAt = Date.now() + THIRTY_DAYS_MS;
  const payload = `ok.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function isValidSessionCookieValue(cookieValue) {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [tag, expiresAtStr, signature] = parts;
  const payload = `${tag}.${expiresAtStr}`;
  const expected = sign(payload);
  const sigOk =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!sigOk) return false;
  const expiresAt = Number(expiresAtStr);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function isAuthenticated(req) {
  return isValidSessionCookieValue(req.cookies && req.cookies[COOKIE_NAME]);
}

// Para pedidos normales de página (navegar a /, /organigramas/, etc.):
// si no hay sesión válida, manda al navegador a /login.html.
function requirePageAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.redirect("/login.html");
}

// Para pedidos de la API (fetch/XHR desde JavaScript): si no hay sesión
// válida, responde 401 en vez de redirigir, para que el front-end lo
// pueda manejar en código.
function requireApiAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: "No autenticado" });
}

module.exports = {
  COOKIE_NAME,
  isAuthenticated,
  requirePageAuth,
  requireApiAuth,
  setSessionCookie,
  clearSessionCookie,
};
