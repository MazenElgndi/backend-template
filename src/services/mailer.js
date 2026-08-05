// @ts-check
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { escapeHtml } from "../utils/escapeHtml.js";

// Standard SMTP transport — works with any provider by just changing the
// .env values (see .env.example). Nothing here is provider-specific.
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE, // true for port 465, false for 587/25 (STARTTLS)
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
});

/**
 * Confirms the SMTP credentials actually work — call this once at server
 * startup so a misconfigured mailbox fails loudly immediately, not
 * silently on someone's first real form submission.
 */
export async function verifyMailer() {
  await transporter.verify();
}

/**
 * Sends a contact-form submission to MAIL_TO, with the submitter set as
 * reply-to — so replying in a normal email client goes straight back to
 * the person who filled the form, not to MAIL_FROM.
 */
export async function sendContactEmail({ name, email, message }) {
  const text = [
    `New contact form submission`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    ``,
    message,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; font-size: 14px; color: #1f241b;">
      <h2 style="margin: 0 0 12px;">New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.MAIL_FROM,
    to: config.MAIL_TO,
    replyTo: email,
    subject: `New message from ${name} (via website contact form)`,
    text,
    html,
  });
}
