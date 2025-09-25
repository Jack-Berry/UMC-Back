const { pool } = require("../db");

/**
 * Get suggested matches for the logged-in user
 */
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

    const { rows: candidates } = await pool.query(
      `SELECT id, name, email, avatar_url, lat, lng, category_scores, tag_scores
       FROM users
       WHERE id <> $1
         AND lat IS NOT NULL AND lng IS NOT NULL
         AND ST_DWithin(
           ST_MakePoint(lng, lat)::geography,
           ST_MakePoint($2, $3)::geography,
           $4 * 1000
         )`,
      [userId, me.lng, me.lat, distanceKm]
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
        usefulForMe,
        usefulForThem,
      };
    });

    matches.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ matches });
  } catch (err) {
    console.error("Match fetch error:", err);
    res.status(500).json({ error: "Database error" });
  }
}

/**
 * Search matches by tag (skill keyword)
 * GET /api/matches/search?tag=plumbing
 */
async function searchMatchesByTag(req, res) {
  const userId = req.user.id;
  const { tag } = req.query;
  const distanceKm = parseInt(req.query.distanceKm || "50", 10);

  if (!tag) {
    return res.status(400).json({ error: "Missing ?tag= parameter" });
  }

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

    const { rows: candidates } = await pool.query(
      `SELECT id, name, email, avatar_url, lat, lng, tag_scores
       FROM users
       WHERE id <> $1
         AND lat IS NOT NULL AND lng IS NOT NULL
         AND ST_DWithin(
           ST_MakePoint(lng, lat)::geography,
           ST_MakePoint($2, $3)::geography,
           $4 * 1000
         )`,
      [userId, me.lng, me.lat, distanceKm]
    );

    const matches = candidates
      .map((u) => {
        const theirTags = u.tag_scores || {};
        const myTags = me.tag_scores || {};
        const myScore = Number(myTags[tag] || 0);
        const theirScore = Number(theirTags[tag] || 0);

        // Only meaningful if they’re strong where I’m weak
        if (myScore < 40 && theirScore > 70) {
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar_url,
            tag,
            myScore,
            theirScore,
          };
        }
        return null;
      })
      .filter(Boolean);

    matches.sort((a, b) => b.theirScore - a.theirScore);

    res.json({ matches });
  } catch (err) {
    console.error("Match search error:", err);
    res.status(500).json({ error: "Database error" });
  }
}

module.exports = { getMatches, searchMatchesByTag };
