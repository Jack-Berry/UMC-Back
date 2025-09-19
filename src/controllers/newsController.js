const { pool } = require("../db");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

// ---------- Public ----------
exports.getAllNews = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT * FROM news 
       ORDER BY pinned DESC, created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ news: result.rows });
  } catch (err) {
    console.error("Error fetching news:", err.message);
    res.status(500).json({ error: "Failed to fetch news" });
  }
};

exports.getNewsById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM news WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching news item:", err.message);
    res.status(500).json({ error: "Failed to fetch news item" });
  }
};

// ---------- Admin ----------

// Lightweight external preview (fetch + jsdom)
exports.getLinkPreview = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const title =
      doc.querySelector("title")?.textContent ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      "";

    const summary =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content") ||
      "";

    const image_url =
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      "";

    res.json({ title, summary, image_url });
  } catch (err) {
    console.error("Preview fetch error:", err.message);
    res.status(500).json({ error: "Could not fetch metadata" });
  }
};

exports.createNews = async (req, res) => {
  const { type, title, content, url, summary, image_url, pinned } = req.body;
  const authorId = req.user?.id;

  if (!title) return res.status(400).json({ error: "Title is required" });

  try {
    const result = await pool.query(
      `INSERT INTO news (type, title, content, url, summary, image_url, author_id, pinned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        type || "native",
        title,
        content,
        url,
        summary,
        image_url,
        authorId,
        pinned || false,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating news:", err.message);
    res.status(500).json({ error: "Failed to create news" });
  }
};

exports.updateNews = async (req, res) => {
  const { id } = req.params;
  const { title, content, url, summary, image_url, pinned } = req.body;

  try {
    const result = await pool.query(
      `UPDATE news
       SET title=$1, content=$2, url=$3, summary=$4, image_url=$5, pinned=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, content, url, summary, image_url, pinned, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating news:", err.message);
    res.status(500).json({ error: "Failed to update news" });
  }
};

exports.deleteNews = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM news WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });

    res.json({ message: "Deleted", deleted: result.rows[0] });
  } catch (err) {
    console.error("Error deleting news:", err.message);
    res.status(500).json({ error: "Failed to delete news" });
  }
};

exports.uploadNewsImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/news/${
    req.file.filename
  }`;

  res.json({ image_url: imageUrl });
};
