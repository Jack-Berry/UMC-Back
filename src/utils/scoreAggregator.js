// src/utils/scoreAggregator.js
const { pool } = require("../db");

/**
 * Recalculate and update category_scores and tag_scores
 * for a single user based on all their non-initial assessment answers.
 *
 * Called after a user submits or updates an assessment.
 */
async function updateUserScores(userId) {
  const sql = `
  WITH cat AS (
    SELECT
      a.user_id,
      jsonb_object_agg(s.category, to_jsonb(s.score100)) AS category_scores
    FROM (
      SELECT
        a.user_id,
        a.category,
        ROUND(AVG(a.score)::numeric * 20)::int AS score100
      FROM user_assessment_answers a
      WHERE a.user_id = $1
        AND a.assessment_type <> 'initial'
        AND a.score IS NOT NULL
      GROUP BY a.user_id, a.category
    ) s
    JOIN user_assessment_answers a ON a.user_id = s.user_id
    GROUP BY a.user_id
  ),
  tags AS (
    SELECT
      a.user_id,
      jsonb_object_agg(s.tag_slug, to_jsonb(s.score100)) AS tag_scores
    FROM (
      SELECT
        a.user_id,
        t.name AS tag_slug,
        ROUND(AVG(a.score)::numeric * 20)::int AS score100
      FROM user_assessment_answers a
      JOIN question_tags qt ON qt.question_id = a.question_id
      JOIN tags t          ON t.id = qt.tag_id
      WHERE a.user_id = $1
        AND a.assessment_type <> 'initial'
        AND a.score IS NOT NULL
      GROUP BY a.user_id, t.name
    ) s
    JOIN user_assessment_answers a ON a.user_id = s.user_id
    GROUP BY a.user_id
  )
  UPDATE users u
  SET
    category_scores = COALESCE(
      (SELECT category_scores FROM cat WHERE cat.user_id = u.id),
      '{}'::jsonb
    ),
    tag_scores = COALESCE(
      (SELECT tag_scores FROM tags WHERE tags.user_id = u.id),
      '{}'::jsonb
    )
  WHERE u.id = $1;
  `;

  try {
    await pool.query(sql, [userId]);
    console.log(`✅ Scores updated for user ${userId}`);
  } catch (err) {
    console.error(`❌ Failed to update scores for user ${userId}:`, err);
    throw err;
  }
}

module.exports = { updateUserScores };
