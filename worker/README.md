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
4. Apply the required D1 migrations in order: schema/001_initial.sql, schema/002_admin_backups_notifications.sql, schema/003_admin_sessions.sql, then schema/004_firebase_google_login.sql.
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


## Security boundary and secret registration

The browser never receives a Firebase Web API key, Google OAuth secret, refresh token, or encryption key. The browser calls the Worker through an HTTPS HttpOnly session cookie.

### Cloudflare Worker Secrets

In Cloudflare Dashboard:

1. Open Workers & Pages -> the `yehyun-portfolio-api` Worker.
2. Open Settings -> Variables and Secrets.
3. Under Secrets, add these names exactly:
   - `FIREBASE_WEB_API_KEY`: the Firebase Web API key used only by the Worker to call Firebase Authentication REST APIs.
   - `GITHUB_CONTENT_TOKEN`: a separate least-privilege GitHub credential used only to create files under `Content/**`.
   - `SESSION_ENCRYPTION_KEY`: a private random 32-byte Base64 key used to encrypt Firebase refresh tokens stored in D1.
   - `GOOGLE_CLIENT_ID`: the Google OAuth client ID.
   - `GOOGLE_CLIENT_SECRET`: the Google OAuth client secret.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: the private random 32-byte Base64 key used to encrypt the Google Drive refresh token.
4. Save each value as an encrypted Secret, not a plaintext variable.
5. Redeploy the Worker after saving or changing secrets.

The repository contains only secret names. `GITHUB_REPOSITORY` and `GITHUB_BRANCH` are public configuration; the GitHub credential is not. Never commit secret values or paste them into chat. The existing Firebase key detected by GitHub must be revoked or rotated in Google Cloud before closing the alert, even though it has been removed from the current source.

### GitHub Actions Secrets

These are separate from Worker Secrets. In GitHub:

1. Open Settings -> Secrets and variables -> Actions.
2. Add repository secrets:
   - `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Account -> D1 -> Edit permission, used only by migration workflows.
   - `CLOUDFLARE_WORKER_API_TOKEN`: a separate Cloudflare API token with Workers Scripts/Workers & Pages edit permission, used only by the Worker deployment workflow.
   - `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account ID.
3. Do not add Firebase keys, OAuth secrets, refresh tokens, or encryption keys to GitHub Actions for the D1 migration workflow.

The D1 workflow uses only the two GitHub secrets above to authenticate Wrangler. It reads SQL files from the repository and never prints secret values.

### Authentication behavior

- `POST /api/auth/login` sends the submitted email and password over HTTPS to the Worker.
- The Worker calls Firebase Authentication, verifies the returned Firebase ID token, and checks `admin_roles`.
- The Worker stores only an encrypted refresh token in D1.
- The browser receives a persistent HttpOnly, Secure, SameSite=None session cookie. The cookie is revoked by `POST /api/auth/logout`.
- Admin API routes accept the session cookie and do not require a Firebase key in the browser.
- Cookie-authenticated requests also require the app-specific X-Portfolio-Request header to reduce cross-site request forgery.

## GitHub Actions D1 migration

The repository includes two manual-only workflows. A normal GitHub commit never changes the production database.

Before running either workflow:

1. In Cloudflare, create an API Token with Account -> D1 -> Edit permission.
2. Copy the Cloudflare Account ID from the dashboard.
3. In GitHub, open Settings -> Secrets and variables -> Actions.
4. Add repository secrets named `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_WORKER_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`.
5. Do not add Firebase keys, OAuth secrets, refresh tokens, or encryption keys to GitHub for this task.

For a new database, or when no previous migration workflow has succeeded:

1. Open Actions -> Apply D1 migrations.
2. Choose the `drill` branch and select Run workflow.
3. Enter exactly `APPLY_D1` in the confirmation field.
4. Run it once.
5. Confirm the steps for schema 001, schema 002, schema 003, and required-table verification all succeed.

If schemas 001 and 002 already succeeded in an earlier run, do not run the full workflow again. Use Actions -> Apply D1 session migration, choose `drill`, enter exactly `APPLY_SESSION_MIGRATION`, and run it once.

The workflows do not register an administrator account. Do not add an `admin_roles` row until the final implementation, Worker deployment, and verification gates pass. If a migration workflow fails, do not register an administrator; report only the failed step and error text, never the API token.

## D1 migration and administrator setup

The `admin_roles` table is created by `schema/001_initial.sql`. If the D1 Console says `no such table: admin_roles`, the migration has not been applied yet. The table may exist before the final registration step; leave it empty until the implementation and deployment gates pass.

In Cloudflare Dashboard:

1. Open Workers & Pages → D1 → `yehyun-portfolio`.
2. Open the Console tab.
3. Copy and run the complete contents of `worker/schema/001_initial.sql`.
4. Confirm that the command completes without an error.
5. Run the administrator insert only after the schema succeeds:

```sql
INSERT INTO admin_roles (uid, created_at)
VALUES ('FIREBASE_UID_FROM_PRIVATE_CONSOLE', datetime('now'));
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


### Current operational state

- The D1 migration workflow is available on `main`.
- The latest migration run completed successfully for schema 001, 002, 003, and required-table verification.
- `worker/wrangler.toml` contains only public configuration and the D1 binding.
- `.github/workflows/deploy-worker.yml` deploys the Worker manually or after Worker-source changes reach `main`.
- GitHub Actions uses only the D1 token, Worker deploy token, and account ID; all Firebase, Google OAuth, refresh-token, and encryption values remain Cloudflare Worker Secrets.

Before the first production Worker verification, confirm the Cloudflare Worker Secrets and Google OAuth redirect URI in the provider consoles. Never add those values to the repository.

## Firebase Google Provider administrator login

The administrator modal offers two independent entry methods:

- Email/password: the Worker calls Firebase Authentication REST accounts:signInWithPassword.
- Google: the Worker starts Google OAuth, exchanges the authorization code server-side, then calls Firebase Authentication REST accounts:signInWithIdp with the Google ID token.

Both paths verify the Firebase ID token and check the UID against the private D1 admin_roles table before creating the same HttpOnly administrator session. The browser never receives the Firebase Web API key, Google client secret, OAuth code, refresh token, or encryption keys.

Before testing Google login, the repository owner must complete these provider-console steps:

1. In Firebase Console -> Authentication -> Sign-in method, enable the Google provider and choose the support email.
2. In Google Cloud Console -> APIs & Services -> Credentials, keep the existing OAuth Web Client and add this authorized redirect URI:
   https://yehyun-portfolio-api.ajas03974.workers.dev/oauth/google/login-callback
3. Keep the existing Drive callback URI as well:
   https://yehyun-portfolio-api.ajas03974.workers.dev/oauth/google/callback
4. Confirm hwahyo-o.github.io is an authorized domain in Firebase Authentication.
5. Apply schema/004_firebase_google_login.sql once through the Apply Firebase Google login migration GitHub Actions workflow after the PR is merged to main.
6. Verify that the Google account's Firebase UID is present in D1 admin_roles. Never place that UID, email, OAuth secret, or password in this repository.

If the existing email/password Firebase user and the Google identity are not linked to the same Firebase UID, Firebase may require account linking or may create a separate Google user. In that case, sign in with the existing email/password account first and link the Google provider to that Firebase user in Firebase Authentication before registering or using the Google-login UID. A Google account that is not present in admin_roles is denied even when its Firebase sign-in succeeds.

The callback state is one-time, stored in D1, and expires after ten minutes. Failed, expired, or non-admin Google sign-ins return to the static site with a generic status message; provider secrets and upstream error payloads are not exposed.

## Firebase Google login migration workflow

After the PR is merged into main:

1. Open GitHub -> Actions -> Apply Firebase Google login migration.
2. Click Run workflow.
3. Select branch main.
4. Enter exactly APPLY_FIREBASE_GOOGLE_LOGIN in the confirmation field.
5. Run it once and confirm the table verification step succeeds.

This migration is separate from the existing D1 migration workflow and should not be repeated after success.


## Member access and UID-owned guestbook

- Google OAuth completes Firebase sign-in in the Worker. A UID present in private D1 `admin_roles` receives an administrator session; every other successful Google account receives a Member session.
- Member-only operations are Guestbook create/update/delete, content sharing and reactions, and Direct Message. The Worker verifies the HttpOnly session and UID for every write; the browser-only login modal is not an authorization control.
- Guestbook passwords are not supported. Existing guestbook messages are preserved by the one-time `schema/007_member_guestbook.sql` migration but have no `author_uid`, so only an administrator can edit or delete them.
- Before deploying this Worker change to an existing D1 database, run **Apply member guestbook migration** once from the intended branch and enter its exact confirmation phrase. Do not rerun it after success: it intentionally removes obsolete password columns.
- To grant the designated administrator account access, obtain its Firebase UID only from the authenticated provider console and insert that UID into private D1. Do not commit, log, or paste the UID, email, password, API key, client secret, refresh token, or encryption key.
