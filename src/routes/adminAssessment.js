// src/routes/adminAssessment.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { pool } = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const { generateQuestionId } = require("../utils/generateQuestionId");

const SNAPSHOT_DIR = path.join(__dirname, "../../sql_snapshots");
const CURRENT_FILE = path.join(
  SNAPSHOT_DIR,
  "reset_and_insert_assessment_questions.sql"
);

// ---------- helpers ----------
function ensureDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function fmtLabel(dateIso) {
  const d = new Date(dateIso);
  return `Saved on ${d.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  })}`;
}

function parseTsFromFilename(file) {
  const m = file.match(/_(\d{8})_(\d{6})\.sql$/);
  if (!m) return null;
  const [_, ymd, hms] = m;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(
    0,
    2
  )}:${hms.slice(2, 4)}:${hms.slice(4, 6)}Z`;
}

function generateResetSQL(rows) {
  const header =
    `DELETE FROM "public"."assessment_questions";\n\n` +
    `INSERT INTO "public"."assessment_questions" ` +
    `("id","assessment_type","category","text","version","active","parent_id","is_initial","is_advanced","sort_order","tags","updated_at") VALUES\n`;

  const values = rows
    .map((r) => {
      const esc = (str) =>
        str === null || str === undefined
          ? "NULL"
          : `'${String(str).replace(/'/g, "''")}'`;
      const bool = (b, def = false) => (typeof b === "boolean" ? b : def);
      const tags =
        Array.isArray(r.tags) && r.tags.length > 0
          ? `'${JSON.stringify(r.tags).replace(/'/g, "''")}'::jsonb`
          : "'[]'::jsonb";

      return `(${esc(r.id)},${esc(r.assessment_type)},${esc(r.category)},${esc(
        r.text
      )},${r.version || 1},${bool(r.active, true)},${esc(r.parent_id)},${bool(
        r.is_initial,
        false
      )},${bool(r.is_advanced, false)},${r.sort_order ?? 0},${tags},NOW())`;
    })
    .join(",\n");

  return header + values + ";\n";
}

// ---------- Categories ----------
router.get("/categories", authenticateToken, requireAdmin, async (req, res) => {
  const { type } = req.query;
  try {
    const params = [];
    let where = "";
    if (type) {
      params.push(type);
      where = `WHERE assessment_type = $1`;
    }
    const { rows } = await pool.query(
      `
      SELECT assessment_type, MIN(category) AS category
      FROM assessment_questions
      ${where}
      GROUP BY assessment_type
      ORDER BY assessment_type
      `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- Questions ----------
router.get("/questions", authenticateToken, requireAdmin, async (req, res) => {
  const { category, type, parent_id } = req.query;
  const params = [];
  const where = [];
  if (type) {
    params.push(type);
    where.push(`assessment_type = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (parent_id) {
    params.push(parent_id);
    where.push(`parent_id = $${params.length}`);
  } else {
    where.push(`parent_id IS NULL`);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const { rows } = await pool.query(
      `
      SELECT id, assessment_type, category, text, parent_id, active, version, sort_order, tags
      FROM assessment_questions
      ${whereClause}
      ORDER BY sort_order NULLS LAST, id
      `,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching questions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- Single Question ----------
router.get(
  "/questions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      const { rows } = await pool.query(
        `
        SELECT id, assessment_type, category, text, parent_id, active, version, sort_order, tags
        FROM assessment_questions
        WHERE id = $1
        `,
        [id]
      );
      if (!rows[0])
        return res.status(404).json({ error: "Question not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Error fetching single question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------- CREATE ----------
router.post("/questions", authenticateToken, requireAdmin, async (req, res) => {
  const {
    assessment_type,
    category,
    text,
    parent_id,
    version = 1,
    active = true,
    sort_order = null,
    tags = [],
  } = req.body;
  if (!assessment_type || !text) {
    return res
      .status(400)
      .json({ error: "assessment_type and text are required" });
  }
  try {
    const client = await pool.connect();
    try {
      const id = await generateQuestionId(client, assessment_type, parent_id);
      const { rows } = await client.query(
        `
        INSERT INTO assessment_questions
          (id, assessment_type, category, text, parent_id, version, active, sort_order, tags)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          id,
          assessment_type,
          category || assessment_type,
          text,
          parent_id || null,
          version,
          active,
          sort_order,
          JSON.stringify(tags),
        ]
      );
      res.status(201).json(rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error creating question:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- UPDATE ----------
router.put(
  "/questions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { category, text, parent_id, version, active, sort_order, tags } =
      req.body;
    try {
      const { rows } = await pool.query(
        `
      UPDATE assessment_questions
      SET category   = COALESCE($1, category),
          text       = COALESCE($2, text),
          parent_id  = $3,
          version    = COALESCE($4, version),
          active     = COALESCE($5, active),
          sort_order = COALESCE($6, sort_order),
          tags       = COALESCE($7, tags)
      WHERE id = $8
      RETURNING *
      `,
        [
          category,
          text,
          parent_id || null,
          version,
          active,
          sort_order,
          tags,
          id,
        ]
      );
      if (!rows[0])
        return res.status(404).json({ error: "Question not found" });
      res.json(rows[0]);
    } catch (err) {
      console.error("Error updating question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------- DELETE + cascade children ----------
router.delete(
  "/questions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("BEGIN");
      await pool.query(
        "DELETE FROM assessment_questions WHERE parent_id = $1",
        [id]
      );
      const { rowCount } = await pool.query(
        "DELETE FROM assessment_questions WHERE id = $1",
        [id]
      );
      await pool.query("COMMIT");
      if (!rowCount)
        return res.status(404).json({ error: "Question not found" });
      res.json({ success: true, id });
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("Error deleting question:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------- Bulk Save ----------
router.patch(
  "/questions/bulk",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { questions } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const q of questions) {
        await client.query(
          `
        UPDATE assessment_questions
        SET text = $1,
            category = $2,
            parent_id = $3,
            sort_order = $4,
            tags = $5
        WHERE id = $6
        `,
          [q.text, q.category, q.parent_id || null, q.sort_order, q.tags, q.id]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Bulk update failed:", err);
      res.status(500).json({ error: "Bulk update failed" });
    } finally {
      client.release();
    }
  }
);

// ---------- Delete an entire assessment type ----------
router.delete(
  "/delete-type/:type",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { type } = req.params;
    if (type === "initial") {
      return res
        .status(400)
        .json({ error: "Cannot delete initial assessment" });
    }
    try {
      const { rowCount } = await pool.query(
        "DELETE FROM assessment_questions WHERE assessment_type = $1",
        [type]
      );
      if (!rowCount)
        return res.status(404).json({ error: "Assessment not found" });
      res.json({ success: true, deleted: rowCount });
    } catch (err) {
      console.error("Error deleting assessment type:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------- Update Category Name ----------
router.patch(
  "/update-category",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const { oldCategory, newCategory } = req.body;
    if (!oldCategory || !newCategory) {
      return res
        .status(400)
        .json({ error: "Both oldCategory and newCategory required" });
    }
    try {
      const { rowCount } = await pool.query(
        `UPDATE assessment_questions
         SET category = $1
         WHERE category = $2 AND assessment_type = 'initial'`,
        [newCategory, oldCategory]
      );
      res.json({ success: true, updated: rowCount });
    } catch (err) {
      console.error("Error updating category:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ---------- Restore Defaults ----------
router.post(
  "/restore-defaults",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    const client = await pool.connect();
    try {
      ensureDir();
      let latestFile = req.body?.filename || null;
      if (!latestFile) {
        latestFile = fs
          .readdirSync(SNAPSHOT_DIR)
          .filter(
            (f) =>
              f.startsWith("reset_and_insert_assessment_questions") &&
              f.endsWith(".sql")
          )
          .sort()
          .pop();
      } else if (latestFile.endsWith(".json")) {
        latestFile = latestFile.replace(/\.json$/, ".sql");
      }
      if (!latestFile) {
        return res.status(404).json({ error: "No snapshot files found" });
      }
      const filePath = path.join(SNAPSHOT_DIR, latestFile);
      const sql = fs.readFileSync(filePath, "utf8");
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      res.json({ success: true, restoredVersion: latestFile });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Restore defaults failed:", err);
      res.status(500).json({ error: "Failed to restore defaults" });
    } finally {
      client.release();
    }
  }
);

// ---------- Save Current State ----------
router.post(
  "/save-defaults",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, assessment_type, category, text, version, active,
                parent_id, is_initial, is_advanced, sort_order, tags
         FROM assessment_questions
         ORDER BY category, sort_order, id`
      );
      const sql = generateResetSQL(rows);
      ensureDir();
      const ts = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\..+/, "")
        .replace("T", "_");
      const filename = `reset_and_insert_assessment_questions_${ts}.sql`;
      const filepath = path.join(SNAPSHOT_DIR, filename);
      fs.writeFileSync(filepath, sql, "utf8");
      const createdAt =
        parseTsFromFilename(filename) || new Date().toISOString();
      const label = req.body?.label || fmtLabel(createdAt);
      const meta = { filename, label, createdAt };
      fs.writeFileSync(
        filepath.replace(".sql", ".json"),
        JSON.stringify(meta, null, 2),
        "utf8"
      );
      fs.writeFileSync(CURRENT_FILE, sql, "utf8");
      res.json({
        success: true,
        savedAs: filename,
        rowCount: rows.length,
        meta,
      });
    } catch (err) {
      console.error("Save defaults failed:", err);
      res.status(500).json({ error: "Failed to save defaults" });
    }
  }
);

// ---------- List Versions ----------
router.get("/versions", authenticateToken, requireAdmin, (req, res) => {
  try {
    ensureDir();
    const metas = fs
      .readdirSync(SNAPSHOT_DIR)
      .filter((f) => f.startsWith("reset_and_insert_assessment_questions_"))
      .reduce((acc, f) => {
        if (f.endsWith(".json")) {
          try {
            const meta = JSON.parse(
              fs.readFileSync(path.join(SNAPSHOT_DIR, f), "utf8")
            );
            if (meta && meta.filename) acc.push(meta);
          } catch {}
        }
        return acc;
      }, []);
    const sqls = fs
      .readdirSync(SNAPSHOT_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          f.startsWith("reset_and_insert_assessment_questions_")
      );
    for (const f of sqls) {
      const jsonPath = path.join(SNAPSHOT_DIR, f.replace(".sql", ".json"));
      if (!fs.existsSync(jsonPath)) {
        const createdAt = parseTsFromFilename(f) || new Date().toISOString();
        metas.push({ filename: f, label: fmtLabel(createdAt), createdAt });
      }
    }
    metas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(metas);
  } catch (err) {
    console.error("List versions failed:", err);
    res.status(500).json({ error: "Failed to list versions" });
  }
});

module.exports = router;
