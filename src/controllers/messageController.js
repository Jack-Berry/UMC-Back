const { pool } = require("../db");

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

// Create or fetch conversation (plaintext mode)
exports.getOrCreateConversation = async (req, res) => {
  try {
    const actorId = req.user.id;
    const { peerId } = req.body;

    const allowed = await isFriends(actorId, peerId);
    if (!allowed) return res.status(403).json({ error: "Not allowed" });

    // Check existing
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
    console.error(err);
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
      `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
      [conversationId, senderId]
    );
    if (!part.length)
      return res.status(403).json({ error: "Not a participant" });

    const { rows: msg } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text)
       VALUES ($1,$2,$3)
       RETURNING id, text, created_at`,
      [conversationId, senderId, text]
    );

    res.json(msg[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// List plaintext messages
exports.listMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const { rows: part } = await pool.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
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

    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
