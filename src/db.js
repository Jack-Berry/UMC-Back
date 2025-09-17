const { Pool } = require("pg");
require("dotenv").config();

console.log("🔍 DB Config (sanitized):", {
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
  // don’t log password for security
});

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD || null, // handles <none> case
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT) || 5432,
  ssl: { rejectUnauthorized: false },
});

// Function to check if DB is reachable
async function checkConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
    console.error("Full error:", err); // dump full object once
    return false;
  }
}

module.exports = { pool, checkConnection };
