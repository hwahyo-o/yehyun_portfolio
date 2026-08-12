# YeHyun Portfolio Worker

This Worker is the server boundary for the GitHub Pages static portfolio.

## Responsibilities

- Verify Firebase ID tokens for administrator endpoints.
- Read and write shared portfolio data in Cloudflare D1.
- Read private Google Drive media through a server-side proxy.
- Keep Google OAuth credentials outside the repository.
- Return a stable JSON error shape to the static app.

The Worker is not copied into the GitHub Pages artifact.

## Initial setup

1. Create a Cloudflare D1 database.
2. Copy `wrangler.toml.example` to a local, ignored Wrangler configuration.
3. Set the real D1 database ID locally.
4. Apply `schema/001_initial.sql`.
5. Set the Google OAuth client ID, client secret, and refresh token as Worker secrets.
6. Deploy the Worker.
7. Set the public Worker URL in a non-secret static configuration value only after the URL exists.
8. Configure Firebase Authentication and add the administrator UID to `admin_roles`.

Never commit client secrets, refresh tokens, Firebase Admin credentials, Cloudflare API tokens, or GitHub tokens.

## Public endpoints

- `GET /api/posts`
- `GET /api/posts/:id`
- `GET /api/updates`
- `GET /api/guestbook`
- `POST /api/guestbook`
- `GET /api/media/:postId/:mediaId`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`

The media endpoint checks D1 visibility before requesting the private Drive file. It forwards the browser Range header for video playback and never returns a Drive access token.

## Required user action before live deployment

The repository code can be reviewed without credentials. Live deployment requires the repository owner to create the D1 database, create the Worker, configure Google OAuth redirect URIs, and enter secrets in Cloudflare. Those values must be entered in the provider consoles, not sent in chat.
