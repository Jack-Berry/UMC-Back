// src/controllers/matchesController.js
const { pool } = require("../db");
const { generateMatchToken } = require("../utils/matchToken");

/**
 * Get suggested matches for the logged-in user
 * Supports:
 *   - distanceKm (default 50)
 *   - minScore (default 80)
 */
async function getMatches(req, res) {
  const userId = req.user.id;
  const distanceKm = parseInt(req.query.distanceKm || "50", 10);
  const minScore = Number(req.query.minScore) || 80;

  try {
    // 1) Current user
    const { rows: meRows } = await pool.query(
      `SELECT id, name, email, lat, lng, category_scores, tag_scores
       FROM users
       WHERE id = $1`,
      [userId]
    );
    if (meRows.length === 0)
      return res.status(404).json({ error: "User not found" });
    const me = meRows[0];

    if (!me.lat || !me.lng) {
      return res.status(400).json({ error: "User has no location set" });
    }

    // 2) Candidates within distance using Haversine (Earth radius = 6371km)
    const { rows: candidates } = await pool.query(
      `SELECT *
       FROM (
         SELECT id, name, email, avatar_url, lat, lng, category_scores, tag_scores,
                (6371 * acos(
                  cos(radians($2)) * cos(radians(lat)) * cos(radians(lng) - radians($3)) +
                  sin(radians($2)) * sin(radians(lat))
                )) AS distance_km
         FROM users
         WHERE id <> $1
           AND lat IS NOT NULL AND lng IS NOT NULL
       ) AS sub
       WHERE distance_km <= $4`,
      [userId, me.lat, me.lng, distanceKm]
    );

    // 3) Score matches
    let matches = candidates.map((u) => {
      const myCats = me.category_scores || {};
      const theirCats = u.category_scores || {};
      const myTags = me.tag_scores || {};
      const theirTags = u.tag_scores || {};

      let categoryScore = 0;
      let tagScore = 0;
      const usefulForMe = [];
      const usefulForThem = [];

      // Category complement
      Object.entries(myCats).forEach(([cat, myVal]) => {
        const myScore = Number(myVal || 0);
        const theirScore = Number(theirCats[cat] || 0);

        if (myScore < 40 && theirScore > 70) {
          categoryScore += 20;
          usefulForMe.push(cat);
        } else if (myScore > 70 && theirScore < 40) {
          categoryScore += 20;
          usefulForThem.push(cat);
        }
      });

      // Tag complement
      Object.entries(myTags).forEach(([tag, myVal]) => {
        const myScore = Number(myVal || 0);
        const theirScore = Number(theirTags[tag] || 0);

        if (myScore < 40 && theirScore > 70) {
          tagScore += 10;
          usefulForMe.push(tag);
        } else if (myScore > 70 && theirScore < 40) {
          tagScore += 10;
          usefulForThem.push(tag);
        }
      });

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar_url,
        matchScore: categoryScore + tagScore,
        distanceKm: Number(u.distance_km?.toFixed(1) || 0),
        usefulForMe,
        usefulForThem,
      };
    });

    // 4) Apply threshold + sort
    matches = matches
      .filter((m) => m.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ matches });
  } catch (err) {
    console.error("Match fetch error details:", err);
    return res
      .status(500)
      .json({ error: "Database error", details: err.message });
  }
}

/**
 * Search matches by tag (skill keyword)
 * GET /api/matches/search?tag=plumbing&distanceKm=50&minScore=80
 */
async function searchMatchesByTag(req, res) {
  const userId = req.user.id;
  const { tag } = req.query;
  const distanceKm = parseInt(req.query.distanceKm || "50", 10);
  const minScore = Number(req.query.minScore) || 0; // allow wider

  if (!tag) return res.status(400).json({ error: "Missing ?tag= parameter" });

  try {
    // 1) Current user
    const { rows: meRows } = await pool.query(
      `SELECT id, name, email, lat, lng, tag_scores
       FROM users
       WHERE id = $1`,
      [userId]
    );
    if (meRows.length === 0)
      return res.status(404).json({ error: "User not found" });
    const me = meRows[0];

    if (!me.lat || !me.lng) {
      return res.status(400).json({ error: "User has no location set" });
    }

    // 2) Candidates within distance
    const { rows: candidates } = await pool.query(
      `SELECT *
       FROM (
         SELECT id, name, email, avatar_url, lat, lng, tag_scores,
                (6371 * acos(
                  cos(radians($2)) * cos(radians(lat)) * cos(radians(lng) - radians($3)) +
                  sin(radians($2)) * sin(radians(lat))
                )) AS distance_km
         FROM users
         WHERE id <> $1
           AND lat IS NOT NULL AND lng IS NOT NULL
       ) AS sub
       WHERE distance_km <= $4`,
      [userId, me.lat, me.lng, distanceKm]
    );

    // 3) Filter by tag presence
    let matches = candidates
      .map((u) => {
        const theirTags = u.tag_scores || {};
        const myTags = me.tag_scores || {};

        const myScore = Number(myTags[tag] || 0);
        const theirScore = Number(theirTags[tag] || 0);

        if (theirScore > 70) {
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar_url,
            tag,
            myScore,
            theirScore,
            distanceKm: Number(u.distance_km?.toFixed(1) || 0),
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.theirScore - a.theirScore);

    return res.json({ matches });
  } catch (err) {
    console.error("Match search error details:", err);
    return res
      .status(500)
      .json({ error: "Database error", details: err.message });
  }
}

/**
 * Internal helper: re-run complement logic between two specific users
 * Used for verifying one-off matches before issuing a token
 */
async function checkIfMatch(userA, userB) {
  const { rows: users } = await pool.query(
    `SELECT id, category_scores, tag_scores, lat, lng FROM users WHERE id IN ($1, $2)`,
    [userA, userB]
  );
  if (users.length !== 2) return false;

  const me = users.find((u) => u.id === userA);
  const them = users.find((u) => u.id === userB);

  if (!me || !them || !me.lat || !me.lng || !them.lat || !them.lng) {
    return false;
  }

  let score = 0;

  const myCats = me.category_scores || {};
  const theirCats = them.category_scores || {};
  Object.entries(myCats).forEach(([cat, myVal]) => {
    const myScore = Number(myVal || 0);
    const theirScore = Number(theirCats[cat] || 0);
    if (myScore < 40 && theirScore > 70) score += 20;
    if (myScore > 70 && theirScore < 40) score += 20;
  });

  const myTags = me.tag_scores || {};
  const theirTags = them.tag_scores || {};
  Object.entries(myTags).forEach(([tag, myVal]) => {
    const myScore = Number(myVal || 0);
    const theirScore = Number(theirTags[tag] || 0);
    if (myScore < 40 && theirScore > 70) score += 10;
    if (myScore > 70 && theirScore < 40) score += 10;
  });

  return score >= 80; // same threshold as getMatches
}

// Generate match tokens
async function getMatchToken(req, res) {
  const actorId = req.user.id;
  const peerId = parseInt(req.query.peerId, 10);
  if (!peerId) return res.status(400).json({ error: "Missing peerId" });

  // 🔹 Re-run your match calculation for this peer
  const isMatch = await checkIfMatch(actorId, peerId);
  if (!isMatch) return res.status(403).json({ error: "Not a match" });

  const token = generateMatchToken(actorId, peerId);
  res.json({ token });
}

module.exports = { getMatches, searchMatchesByTag, getMatchToken };
