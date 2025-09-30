const { pool } = require("../db");

// Get all events (optionally sorted by distance)
exports.getEvents = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null; // logged-in user if available
    const { lat, lng } = req.query;

    let result;

    if (lat && lng) {
      // With distance calculation
      result = await pool.query(
        `
        SELECT e.*,
               u.display_name AS creator_name,
               CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END AS is_registered,
               (6371 * acos(
                 cos(radians($2)) *
                 cos(radians(e.latitude)) *
                 cos(radians(e.longitude) - radians($3)) +
                 sin(radians($2)) *
                 sin(radians(e.latitude))
               )) AS distance_km
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_registrations r ON e.id = r.event_id AND r.user_id = $1
        ORDER BY distance_km ASC
        `,
        [userId, lat, lng]
      );
    } else {
      // Default: sort by date
      result = await pool.query(
        `
        SELECT e.*,
               u.display_name AS creator_name,
               CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END AS is_registered
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_registrations r ON e.id = r.event_id AND r.user_id = $1
        ORDER BY e.start_at ASC
        `,
        [userId]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

// Create event
exports.createEvent = async (req, res) => {
  const {
    title,
    description,
    venue,
    location,
    latitude,
    longitude,
    start_at,
    end_at,
  } = req.body;

  if (!title || !description || !location || !start_at) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (title, description, venue, location, latitude, longitude, start_at, end_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        description,
        venue || null,
        location,
        latitude || null,
        longitude || null,
        start_at,
        end_at || null,
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
};

// Register interest
exports.registerInterest = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `INSERT INTO event_registrations (event_id, user_id, registered_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id, user_id) DO NOTHING
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      // Already registered
      return res.json({ message: "Already registered", already: true });
    }

    res.json({ message: "Registered interest", registration: result.rows[0] });
  } catch (err) {
    console.error("Register interest error:", err);
    res.status(500).json({ error: "Failed to register interest" });
  }
};

// Unregister interest
exports.unregisterInterest = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM event_registrations
       WHERE event_id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      // Wasn’t registered
      return res.status(404).json({ message: "No registration found" });
    }

    res.json({ message: "Unregistered successfully", removed: result.rows[0] });
  } catch (err) {
    console.error("Unregister interest error:", err);
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

// Get single event details
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT e.*, u.display_name AS creator_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
};

// Update event
exports.updateEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    venue,
    location,
    latitude,
    longitude,
    start_at,
    end_at,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           venue = COALESCE($3, venue),
           location = COALESCE($4, location),
           latitude = COALESCE($5, latitude),
           longitude = COALESCE($6, longitude),
           start_at = COALESCE($7, start_at),
           end_at = COALESCE($8, end_at),
           updated_at = NOW()
       WHERE id = $9 AND created_by = $10
       RETURNING *`,
      [
        title || null,
        description || null,
        venue || null,
        location || null,
        latitude || null,
        longitude || null,
        start_at || null,
        end_at || null,
        id,
        req.user.id,
      ]
    );

    if (result.rowCount === 0) {
      return res
        .status(403)
        .json({ error: "Not authorized or event not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
};

// Delete event
exports.deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM events WHERE id = $1 AND created_by = $2 RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res
        .status(403)
        .json({ error: "Not authorized or event not found" });
    }

    res.json({ message: "Event deleted", removed: result.rows[0] });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
};
