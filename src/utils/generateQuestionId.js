// utils/generateQuestionId.js
async function generateQuestionId(client, assessmentType, parentId = null) {
  if (!parentId) {
    // Parent question
    const { rows } = await client.query(
      `SELECT id FROM assessment_questions WHERE assessment_type=$1 AND parent_id IS NULL`,
      [assessmentType]
    );

    // Extract all numeric suffixes
    let maxNum = 0;
    for (const row of rows) {
      const match = row.id.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    }

    return `${assessmentType}-${maxNum + 1}`;
  } else {
    // Follow-up question
    const { rows } = await client.query(
      `SELECT id FROM assessment_questions WHERE parent_id=$1`,
      [parentId]
    );

    // Extract all letter suffixes
    let maxCharCode = 96; // 'a' - 1
    for (const row of rows) {
      const match = row.id.match(/([a-z])$/i);
      if (match) {
        const code = match[1].toLowerCase().charCodeAt(0);
        if (code > maxCharCode) maxCharCode = code;
      }
    }

    const nextLetter = String.fromCharCode(maxCharCode + 1);
    return `${parentId}${nextLetter}`;
  }
}

module.exports = { generateQuestionId };
