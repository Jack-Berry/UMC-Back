const { pool } = require("../db");

// Send friend request
exports.sendRequest = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const receiverId = parseInt(req.params.id, 10);

    if (requesterId === receiverId) {
      return res.status(400).json({ error: "You cannot friend yourself." });
    }

    const result = await pool.query(
      `INSERT INTO friends (requester_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))
       DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [requesterId, receiverId]
    );

    res.json({ message: "Friend request sent", request: result.rows[0] });
  } catch (err) {
    console.error("Send friend request error:", err);
    res.status(500).json({ error: "Failed to send friend request" });
  }
};

// Accept friend request
exports.acceptRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `UPDATE friends f
       SET status = 'accepted', updated_at = NOW()
       WHERE f.id = $1 AND f.receiver_id = $2 AND f.status = 'pending'
       RETURNING f.*`,
      [requestId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No pending request found" });
    }

    // Now join to return full friend info (other user)
    const row = result.rows[0];
    const otherUserId =
      row.requester_id === userId ? row.receiver_id : row.requester_id;

    const friendData = await pool.query(
      `SELECT u.id, u.display_name, u.avatar_url
       FROM users u
       WHERE u.id = $1`,
      [otherUserId]
    );

    res.json({
      message: "Friend request accepted",
      friend: friendData.rows[0],
    });
  } catch (err) {
    console.error("Accept friend request error:", err);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
};

// Decline friend request
exports.declineRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `DELETE FROM friends
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No pending request found" });
    }

    res.json({ message: "Friend request declined" });
  } catch (err) {
    console.error("Decline friend request error:", err);
    res.status(500).json({ error: "Failed to decline friend request" });
  }
};

// Remove friend
exports.removeFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `DELETE FROM friends
       WHERE (requester_id = $1 AND receiver_id = $2)
          OR (requester_id = $2 AND receiver_id = $1)
       RETURNING *`,
      [userId, friendId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Friendship not found" });
    }

    res.json({ message: "Friend removed" });
  } catch (err) {
    console.error("Remove friend error:", err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
};

// Get all friends for current user
exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT u.id, u.display_name, u.avatar_url, f.status, f.created_at
       FROM friends f
       JOIN users u ON (u.id = CASE 
         WHEN f.requester_id = $1 THEN f.receiver_id
         ELSE f.requester_id END)
       WHERE (f.requester_id = $1 OR f.receiver_id = $1)
         AND f.status = 'accepted'`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get friends error:", err);
    res.status(500).json({ error: "Failed to fetch friends" });
  }
};

// Get pending requests for current user
exports.getPending = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT f.id AS request_id, u.id AS requester_id, u.display_name, u.avatar_url, f.created_at
       FROM friends f
       JOIN users u ON f.requester_id = u.id
       WHERE f.receiver_id = $1 AND f.status = 'pending'`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get pending requests error:", err);
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
};
