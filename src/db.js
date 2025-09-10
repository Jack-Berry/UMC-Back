const { Pool } = require("pg");
require("dotenv").config();

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
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
    console.error("DB connection error:", err.message);
    return false;
  }
}

module.exports = { pool, checkConnection };
