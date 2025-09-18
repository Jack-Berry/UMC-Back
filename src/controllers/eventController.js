const { pool } = require("../db");

// Get all events
exports.getEvents = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null; // logged-in user if available

    const result = await pool.query(
      `
      SELECT e.*,
             u.name AS creator_name,
             CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END AS is_registered
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN event_registrations r ON e.id = r.event_id AND r.user_id = $1
      ORDER BY start_at ASC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  const { title, description, location, start_at, end_at } = req.body;

  if (!title || !description || !location || !start_at) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (title, description, location, start_at, end_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description, location, start_at, end_at || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create event" });
  }
};

// Register interest
exports.registerInterest = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `INSERT INTO event_registrations (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );
    res.json({ message: "Registered interest" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register interest" });
  }
};

// Unregister interest
exports.unregisterInterest = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `DELETE FROM event_registrations 
       WHERE event_id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    res.json({ message: "Unregistered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unregister" });
  }
};

// Get events a user is registered for
exports.getUserEvents = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT e.*
       FROM events e
       JOIN event_registrations r ON e.id = r.event_id
       WHERE r.user_id = $1
       ORDER BY e.start_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user events" });
  }
};
