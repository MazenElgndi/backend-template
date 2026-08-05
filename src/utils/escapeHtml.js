const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes user-supplied text before it's interpolated into an HTML email
 * body. Required per SECURITY-NOTES.md / the site brief's C3 rule: any
 * user-provided content that ends up rendered (HTML email clients render
 * the body) must be sanitized, not inserted as-is.
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
