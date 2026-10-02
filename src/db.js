// Conexión a la base de datos compartida (PostgreSQL) y creación automática
// de la tabla que necesitamos la primera vez que arranca el servidor.
// No hace falta correr ninguna migración a mano: si la tabla no existe, se crea sola.

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway's managed Postgres needs SSL from outside its private network,
  // but local/dev connections (and Railway's internal network) don't use it.
  ssl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
      ? { rejectUnauthorized: false }
      : false,
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      module      TEXT PRIMARY KEY,
      data        JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Devuelve el objeto guardado para un módulo ("organigramas" | "perfiles"),
// o {} si todavía no hay nada guardado (primer uso).
async function getState(moduleName) {
  const { rows } = await pool.query(
    "SELECT data FROM app_state WHERE module = $1",
    [moduleName]
  );
  return rows.length ? rows[0].data : {};
}

// Reemplaza por completo el objeto guardado para un módulo.
async function setState(moduleName, data) {
  await pool.query(
    `INSERT INTO app_state (module, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (module)
     DO UPDATE SET data = $2::jsonb, updated_at = now()`,
    [moduleName, JSON.stringify(data)]
  );
}

module.exports = { pool, ensureSchema, getState, setState };
