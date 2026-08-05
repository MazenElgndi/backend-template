# Connecting the frontend to the backend

These two projects are deployed and hosted separately, and only need to
agree on two URLs to work together. Nothing else couples them.

## The two settings that must match

| Where | Variable | Set to |
|---|---|---|
| Backend `.env` | `ALLOWED_ORIGIN` | The frontend's real deployed URL (e.g. `https://client-site.com`) |
| Frontend `.env` | `VITE_CONTACT_API_URL` | The backend's real deployed URL + `/api/contact` (e.g. `https://api.client-site.com/api/contact`) |

If these don't match exactly (including `https://` and no trailing slash
mismatches), the browser will block the request with a CORS error — that's
the CORS lock in `src/app.js` working as designed, not a bug. If the form
fails in production, this is the first thing to check.

## What's already wired up
`src/pages/Contact.jsx` in the frontend already:
- Reads `VITE_CONTACT_API_URL` and calls it directly — no other frontend
  file needs to change.
- Renders a plain explanatory message instead of the form if that
  variable isn't set at all, rather than silently trying to submit to
  nothing.
- Includes the honeypot field (`website`), visually hidden and pulled out
  of tab order — required by the backend's spam handling. If you rebuild
  the contact form from scratch for a different design, keep this field
  and keep it genuinely hidden from real visitors.
- Shows field-level validation errors returned by the backend (`400`
  responses), and a generic retry message for anything else.

## Local development
Run both at once, in two terminals:
```bash
# terminal 1
cd backend-template && npm run dev      # http://localhost:3001

# terminal 2
cd bridged-project && npm run dev        # http://localhost:5173 (Vite's default)
```
Set the frontend's `.env` to `VITE_CONTACT_API_URL=http://localhost:3001/api/contact`
and the backend's `.env` to `ALLOWED_ORIGIN=http://localhost:5173` (match
whatever port Vite actually prints — it's not always 5173 if that port is
busy).

## Verifying it actually works before handing off to a client
1. Fill out the real form in a browser and submit it.
2. Confirm the email arrives at `MAIL_TO`.
3. Confirm replying to that email goes to the person who submitted the
   form (not `MAIL_FROM`) — this comes from `replyTo` in
   `backend-template/src/services/mailer.js`.
4. Submit obviously-invalid data (bad email, empty message) and confirm
   the form shows an inline error instead of a silent failure.
