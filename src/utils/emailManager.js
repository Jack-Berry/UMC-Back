// src/utils/emailManager.js
import nodemailer from "nodemailer";

let transporter;

/**
 * Initialise the transporter once and reuse it
 */
export function initEmailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "mail.gandi.net",
      port: 465, // SSL (or use 587 with secure: false and requireTLS: true)
      secure: true,
      auth: {
        user: process.env.GANDI_MAIL_USER, // "noreply@uselessmen.org"
        pass: process.env.GANDI_MAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Send a generic email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML body
 * @param {string} [options.text] - Optional plain text body
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    const transporter = initEmailTransporter();
    const info = await transporter.sendMail({
      from: `"Useless Men’s Co-Operative" <${process.env.GANDI_MAIL_USER}>`,
      to,
      subject,
      text: text || "",
      html,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { success: false, error: err.message };
  }
}
