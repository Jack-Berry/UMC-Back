const { pool } = require("../db");
const { getIO } = require("../socket");

// helper: check if two users are friends
async function isFriends(userA, userB) {
  const { rows } = await pool.query(
    `SELECT 1 FROM friends
     WHERE ((requester_id=$1 AND receiver_id=$2) OR (requester_id=$2 AND receiver_id=$1))
     AND status='accepted' LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

// ---------- Public ----------

// Create or fetch conversation
exports.getOrCreateConversation = async (req, res) => {
  try {
    const actorId = req.user.id;
    const { peerId } = req.body;

    const allowed = await isFriends(actorId, peerId);
    if (!allowed) return res.status(403).json({ error: "Not allowed" });

    // Check existing conversation
    const { rows: found } = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants p1 ON p1.conversation_id=c.id AND p1.user_id=$1
       JOIN conversation_participants p2 ON p2.conversation_id=c.id AND p2.user_id=$2
       LIMIT 1`,
      [actorId, peerId]
    );
    if (found.length) return res.json({ id: found[0].id });

    // Create new conversation
    const { rows } = await pool.query(
      `INSERT INTO conversations (created_by, key_salt)
       VALUES ($1, decode(repeat('00',32),'hex'))
       RETURNING id`,
      [actorId]
    );
    const convId = rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1,$2),($1,$3)`,
      [convId, actorId, peerId]
    );

    res.json({ id: convId });
  } catch (err) {
    console.error("Error creating conversation:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Send plaintext message
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const conversationId = req.params.id;
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Message text required" });

    const { rows: part } = await pool.query(
      `SELECT 1 FROM conversation_participants 
       WHERE conversation_id=$1 AND user_id=$2`,
      [conversationId, senderId]
    );
    if (!part.length)
      return res.status(403).json({ error: "Not a participant" });

    const { rows: msg } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text)
       VALUES ($1,$2,$3)
       RETURNING id, sender_id, text, created_at`,
      [conversationId, senderId, text]
    );

    const message = {
      id: msg[0].id,
      senderId: msg[0].sender_id,
      text: msg[0].text,
      createdAt: msg[0].created_at,
      conversationId,
    };

    // 🔹 Emit socket event
    getIO().to(`thread_${conversationId}`).emit("newMessage", message);

    res.json(message);
  } catch (err) {
    console.error("Error sending message:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// List messages
exports.listMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const { rows: part } = await pool.query(
      `SELECT 1 FROM conversation_participants 
       WHERE conversation_id=$1 AND user_id=$2`,
      [conversationId, userId]
    );
    if (!part.length)
      return res.status(403).json({ error: "Not a participant" });

    const { rows: msgs } = await pool.query(
      `SELECT id, sender_id, text, created_at
       FROM messages
       WHERE conversation_id=$1
       ORDER BY id ASC`,
      [conversationId]
    );

    // 🔹 Normalize keys
    const normalized = msgs.map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      text: m.text,
      createdAt: m.created_at,
      conversationId,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Error listing messages:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// List threads
exports.listThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `
      SELECT c.id, c.created_at, json_agg(u.id) AS participants
      FROM conversations c
      JOIN conversation_participants p ON p.conversation_id = c.id
      JOIN users u ON u.id = p.user_id
      WHERE c.id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id=$1
      )
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `,
      [userId]
    );

    // normalize participants
    const normalized = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      participants: r.participants,
    }));

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
