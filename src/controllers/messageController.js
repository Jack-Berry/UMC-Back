const { pool } = require("../db");
const { getIO } = require("../socket");
const { verifyMatchToken } = require("../utils/matchToken");
const { deriveConvKey, encryptMessage, decryptMessage } = require("../crypto");

// helper: check if two users are friends
async function isFriends(userA, userB) {
  const { rows } = await pool.query(
    `SELECT 1 FROM friends
     WHERE ((requester_id=$1 AND receiver_id=$2) OR (requester_id=$2 AND receiver_id=$1))
     AND status='accepted'
     LIMIT 1`,
    [userA, userB]
  );
  return rows.length > 0;
}

// ---------- Public ----------

// Create or fetch conversation
exports.getOrCreateConversation = async (req, res) => {
  try {
    const actorId = req.user?.id;

    const rawPeerId =
      (req.body && (req.body.peerId ?? req.body.peer_id)) ??
      req.query?.peerId ??
      req.params?.peerId;

    const matchToken =
      (req.body && (req.body.matchToken ?? req.body.match_token)) ??
      req.query?.matchToken ??
      req.params?.matchToken;

    const peerId = rawPeerId != null ? parseInt(rawPeerId, 10) : NaN;

    if (!actorId || !Number.isInteger(peerId)) {
      return res.status(400).json({ error: "Invalid or missing peerId" });
    }

    // AuthZ: friends OR a verified one-off match token
    let allowed = await isFriends(actorId, peerId);
    if (!allowed && matchToken) {
      allowed = verifyMatchToken(matchToken, actorId, peerId);
    }
    if (!allowed) {
      return res.status(403).json({ error: "Not allowed" });
    }

    // Existing conversation?
    const { rows: found } = await pool.query(
      `SELECT c.id
         FROM conversations c
         JOIN conversation_participants p1
           ON p1.conversation_id = c.id AND p1.user_id = $1
         JOIN conversation_participants p2
           ON p2.conversation_id = c.id AND p2.user_id = $2
         LIMIT 1`,
      [actorId, peerId]
    );
    if (found.length) {
      return res.json({ id: found[0].id });
    }

    // Create conversation
    const { rows } = await pool.query(
      `INSERT INTO conversations (created_by, key_salt)
       VALUES ($1, gen_random_bytes(32))
       RETURNING id`,
      [actorId]
    );
    const convId = rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [convId, actorId, peerId]
    );

    res.json({ id: convId });
  } catch (err) {
    console.error("❌ Error creating conversation", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const conversationId = req.params.id;
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Message text required" });

    const { rows: conv } = await pool.query(
      `SELECT key_salt FROM conversations WHERE id=$1`,
      [conversationId]
    );
    if (!conv.length)
      return res.status(404).json({ error: "Conversation not found" });

    const key = deriveConvKey(conv[0].key_salt, conversationId);
    const aadObj = { conversationId, senderId };

    const { ciphertext, iv, tag, aad } = encryptMessage({
      plaintext: text,
      key,
      aadObj,
    });

    const { rows: msg } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, ciphertext, iv, tag, aad)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, sender_id, created_at`,
      [
        conversationId,
        senderId,
        ciphertext.toString("base64"),
        iv.toString("base64"),
        tag.toString("base64"),
        aad.toString("base64"),
      ]
    );

    const message = {
      id: msg[0].id,
      senderId: msg[0].sender_id,
      text, // plaintext for immediate return to sender
      createdAt: msg[0].created_at,
      conversationId,
    };

    res.json(message);
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// List messages
exports.listMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const { rows: conv } = await pool.query(
      `SELECT key_salt FROM conversations WHERE id=$1`,
      [conversationId]
    );
    if (!conv.length)
      return res.status(404).json({ error: "Conversation not found" });

    const key = deriveConvKey(conv[0].key_salt, conversationId);

    const { rows: msgs } = await pool.query(
      `SELECT id, sender_id, ciphertext, iv, tag, aad, created_at
       FROM messages
       WHERE conversation_id=$1
       ORDER BY id ASC`,
      [conversationId]
    );

    const normalized = msgs.map((m) => {
      const text = decryptMessage({
        ciphertext: Buffer.from(m.ciphertext, "base64"),
        key,
        iv: Buffer.from(m.iv, "base64"),
        tag: Buffer.from(m.tag, "base64"),
        aad: Buffer.from(m.aad, "base64"),
      });
      return {
        id: m.id,
        senderId: m.sender_id,
        text,
        createdAt: m.created_at,
        conversationId,
      };
    });

    res.json(normalized);
  } catch (err) {
    console.error("Error listing messages:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// List threads with full participant details, only if messages exist
exports.listThreads = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `
      SELECT c.id,
             c.created_at,
             json_agg(json_build_object('id', u.id, 'display_name', u.display_name, 'avatar', u.avatar_url)) AS participants,
             COALESCE((
               SELECT COUNT(*)
               FROM messages m
               WHERE m.conversation_id = c.id
                 AND m.id > COALESCE((
                   SELECT last_read_msg_id
                   FROM message_reads mr
                   WHERE mr.user_id = $1 AND mr.conversation_id = c.id
                 ), 0)
             ), 0) AS unread_count
      FROM conversations c
      JOIN conversation_participants p ON p.conversation_id = c.id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN LATERAL (
        SELECT id
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY id DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN message_reads mr
        ON mr.conversation_id = c.id AND mr.user_id = $1
      WHERE c.id IN (
        SELECT conversation_id FROM conversation_participants WHERE user_id=$1
      )
      AND EXISTS (
        SELECT 1 FROM messages m WHERE m.conversation_id = c.id
      )
      GROUP BY c.id, lm.id, mr.last_read_msg_id
      ORDER BY c.created_at DESC
      `,
      [userId]
    );

    const normalized = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      participants: r.participants || [],
      lastMessageId: r.last_message_id,
      lastReadMsgId: r.last_read_msg_id,
      unreadCount: parseInt(r.unread_count, 10) || 0,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Error listing threads:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// PUT /api/msg/threads/:id/read
exports.markRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { lastReadMsgId } = req.body;

    await pool.query(
      `INSERT INTO message_reads (conversation_id, user_id, last_read_msg_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET last_read_msg_id = EXCLUDED.last_read_msg_id`,
      [conversationId, userId, lastReadMsgId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking read:", err);
    res.status(500).json({ error: "Server error" });
  }
};
