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
4. Apply `schema/001_initial.sql`, then `schema/002_admin_backups_notifications.sql`.
5. Set the Google OAuth client ID, client secret, and refresh token as Worker secrets.
6. Deploy the Worker and complete the static/API verification gates.
7. Set the public Worker URL in a non-secret static configuration value only after the URL exists.
8. Only after the final migration and main-merge gate, configure Firebase Authentication and add the administrator UID to `admin_roles`.

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


## GitHub Actions D1 migration

The repository includes .github/workflows/apply-d1-migrations.yml. It is manual-only, so a normal GitHub commit does not change the production database.

Before running it:

1. In Cloudflare, create an API Token with Account -> D1 -> Edit permission. D1 writes require D1:Edit.
2. Copy the Cloudflare Account ID from the dashboard.
3. In GitHub, open Settings -> Secrets and variables -> Actions.
4. Add these repository secrets:
   - CLOUDFLARE_API_TOKEN: the Cloudflare API token.
   - CLOUDFLARE_ACCOUNT_ID: the Cloudflare account ID.
5. Open the repository Actions tab.
6. Select Apply D1 migrations.
7. Select the drill branch and choose Run workflow.
8. In the confirmation field, enter exactly APPLY_D1.
9. Confirm that the workflow completes all three steps: initial schema, administrator feature schema, and required-table verification.

The workflow applies the two SQL files to the remote database through Wrangler. It does not register an administrator account. Run it once for an empty database. Do not run it again after migration 002 has succeeded because its ALTER TABLE statements are intentionally not repeatable.

If the workflow fails, do not register admin_roles. Read the failed step output and report the step name and error text without sharing the API token.

## D1 migration and administrator setup

The `admin_roles` table is created by `schema/001_initial.sql`. If the D1 Console says `no such table: admin_roles`, the migration has not been applied yet. The table may exist before the final registration step; leave it empty until the implementation and deployment gates pass.

In Cloudflare Dashboard:

1. Open Workers & Pages → D1 → `yehyun-portfolio`.
2. Open the Console tab.
3. Copy and run the complete contents of `worker/schema/001_initial.sql`.
4. Confirm that the command completes without an error.
5. Run the administrator insert only after the schema succeeds:

```sql
INSERT INTO admin_roles (uid, email, created_at)
VALUES ('YOUR_FIREBASE_ADMIN_UID', 'YOUR_ADMIN_EMAIL', datetime('now'));
```

Do not add an administrator UID or email to the public repository. The value belongs in the private D1 database, and the insert is intentionally deferred until the final gate.

## Creating GOOGLE_TOKEN_ENCRYPTION_KEY

This secret is not a Firebase key and is not a Google OAuth client ID. It is a private 32-byte key used by the Worker to encrypt the Google Drive refresh token before storing it in D1.

The value may be generated privately in advance and entered directly in Cloudflare; no local generation step is required during this implementation. The Worker requires this secret to decode to exactly 32 bytes when Base64-decoded. If the value already entered by the repository owner meets that condition, keep it unchanged. If it is human-readable, shorter, or was exposed outside the secret store, replace it before production. Do not commit it or send it in chat. Keep the final value permanently; changing it makes previously stored Drive refresh tokens unreadable.

Also add `GOOGLE_CLIENT_SECRET` as a Worker Secret using the secret shown once by Google Cloud when the OAuth Web Client was created. Do not put it in `wrangler.toml`, GitHub, or the browser.


## Administrator settings and backup behavior

After administrator authentication is verified by the Worker, the static header shows notifications, settings, and logout controls.

- Firebase Auth uses local persistence until the administrator explicitly logs out.
- Google Drive connection status is stored server-side; disconnecting removes the encrypted refresh token from D1 but does not delete existing Drive backups.
- Manual backup is created from the settings modal.
- Automatic backup is requested only while the administrator page is visible and authenticated, within the first two minutes of 00:00, 08:00, or 16:00 KST. Closing the page or leaving it hidden does not create a catch-up backup.
- Backups are stored under `Portfolio-con/Backups/YYYY-MM-DD/` and are listed newest first.
- Restore replaces shared D1 content tables but never replaces `admin_roles` or Google OAuth connection data.
- Download and restore endpoints require the administrator Firebase ID token.

## Migration order

Apply both files in order to a new D1 database. Do not insert an administrator row during this migration step:

1. `worker/schema/001_initial.sql`
2. `worker/schema/002_admin_backups_notifications.sql`

For an existing database that already has `001_initial.sql`, apply only `002_admin_backups_notifications.sql`. Register the administrator UID in `admin_roles` only after the implementation, Worker deployment, verification, and main-merge gates have passed.
