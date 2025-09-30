const express = require("express");
const { sendEmail } = require("../utils/emailManager.js");

const router = express.Router();

// Dummy test endpoint
router.post("/send-test", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const result = await sendEmail({
    to: email,
    subject: "UMC Test Email",
    html: `
      <h1>UMC Test Email</h1>
      <p>If you're reading this, email sending works</p>
    `,
  });

  if (result.success) {
    return res.json({ success: true, messageId: result.messageId });
  } else {
    return res.status(500).json({ success: false, error: result.error });
  }
});

export default router;
