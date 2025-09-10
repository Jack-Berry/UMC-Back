const { Pool } = require("pg");
require("dotenv").config();

let pool;
let isConnected = false;

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

try {
  pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: Number(process.env.PGPORT),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  // Try a test connection on startup
  pool
    .connect()
    .then((client) => {
      console.log("Connected to Postgres");
      isConnected = true;
      client.release();
    })
    .catch((err) => {
      console.error("Could not connect to Postgres:", err.message);
      isConnected = false;
    });
} catch (err) {
  console.error("Pool init error:", err.message);
  isConnected = false;
}

module.exports = { pool, isConnected };
