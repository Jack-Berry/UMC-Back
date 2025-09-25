const { pool } = require("../db");

async function getMatches(req, res) {
  const userId = req.user.id;
  const distanceKm = parseInt(req.query.distanceKm || "50", 10);

  try {
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

    const matches = candidates.map((u) => {
      const myCats = me.category_scores || {};
      const theirCats = u.category_scores || {};
      const myTags = me.tag_scores || {};
      const theirTags = u.tag_scores || {};

      let categoryScore = 0;
      let usefulForMe = [];
      let usefulForThem = [];

      Object.entries(myCats).forEach(([cat, myScore]) => {
        const theirScore = Number(theirCats[cat] || 0);
        if (myScore < 40 && theirScore > 70) {
          categoryScore += 20;
          usefulForMe.push(cat);
        } else if (myScore > 70 && theirScore < 40) {
          categoryScore += 20;
          usefulForThem.push(cat);
        }
      });

      let tagScore = 0;
      Object.entries(myTags).forEach(([tag, myScore]) => {
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

    matches.sort((a, b) => b.matchScore - a.matchScore);
    res.json({ matches });
  } catch (err) {
    console.error("Match fetch error details:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
}

async function searchMatchesByTag(req, res) {
  const userId = req.user.id;
  const { tag } = req.query;
  const distanceKm = parseInt(req.query.distanceKm || "50", 10);

  if (!tag) return res.status(400).json({ error: "Missing ?tag= parameter" });

  try {
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

    const matches = candidates
      .map((u) => {
        const theirTags = u.tag_scores || {};
        const myTags = me.tag_scores || {};
        const myScore = Number(myTags[tag] || 0);
        const theirScore = Number(theirTags[tag] || 0);

        if (myScore < 40 && theirScore > 70) {
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
      .filter(Boolean);

    matches.sort((a, b) => b.theirScore - a.theirScore);
    res.json({ matches });
  } catch (err) {
    console.error("Match search error details:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
}

module.exports = { getMatches, searchMatchesByTag };
