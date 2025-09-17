const { Pool } = require("pg");
require("dotenv").config();

console.log("🔍 DB Config (sanitized):", {
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD || null,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT) || 5432,
  ssl: false,
});

async function checkConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
    return false;
  }
}

module.exports = { pool, checkConnection };
