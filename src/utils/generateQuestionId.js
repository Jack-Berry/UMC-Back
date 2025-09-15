// utils/generateQuestionId.js
async function generateQuestionId(client, assessmentType, parentId = null) {
  if (!parentId) {
    // parent question
    const { rows } = await client.query(
      `SELECT id FROM assessment_questions WHERE assessment_type=$1 AND parent_id IS NULL ORDER BY sort_order DESC LIMIT 1`,
      [assessmentType]
    );
    const last = rows[0]?.id;
    let nextNum = 1;
    if (last) {
      const match = last.match(/-(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    return `${assessmentType}-${nextNum}`;
  } else {
    // follow-up
    const { rows } = await client.query(
      `SELECT id FROM assessment_questions WHERE parent_id=$1 ORDER BY id DESC LIMIT 1`,
      [parentId]
    );
    const last = rows[0]?.id;
    let nextLetter = "a";
    if (last) {
      const match = last.match(/([a-z])$/i);
      if (match) {
        const code = match[1].charCodeAt(0) + 1;
        nextLetter = String.fromCharCode(code);
      }
    }
    return `${parentId}${nextLetter}`;
  }
}

module.exports = { generateQuestionId };
