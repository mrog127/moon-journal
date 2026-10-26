# Moon Journal

A daily moon journal: 24-hour moon chart, live compass, phase, journal text and photos.
Static site (GitHub Pages) + Supabase for sign-in, entries and photos.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app, including the sign-in page |
| `config.js` | Your Supabase project URL and anon key |
| `supabase/schema.sql` | Creates the `entries` table, the private `photos` bucket, and the rules that keep each account's data private |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## 1. Set up Supabase (about 10 minutes)

1. Create a free account at supabase.com and click **New project**. Any name and region (pick US East). Save the database password somewhere; the app doesn't need it.
2. When the project is ready, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**. It should say "Success. No rows returned."
3. Create your login: **Authentication → Users → Add user → Create new user**. Enter your email and a password, and tick **Auto Confirm User**.
4. Close public sign-ups: **Authentication → Sign In / Providers → Email**, turn off **Allow new users to sign up**, and save. Nobody else can make an account.
5. Copy your keys: **Project Settings → API** (or **Data API**). Copy the **Project URL** and the **anon public** key into `config.js`.

## 2. Put it on GitHub Pages

1. On github.com, create a new repository (for example `moon-journal`). Public is fine: no journal data lives in the repo.
2. Upload `index.html`, `config.js`, `.nojekyll` and the `supabase` folder (**Add file → Upload files**), then commit.
3. **Settings → Pages**: set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
4. After a minute the site is live at `https://<your-username>.github.io/moon-journal/`.

## 3. Point Supabase at the site

In Supabase, **Authentication → URL Configuration**:
- **Site URL**: your GitHub Pages URL
- **Redirect URLs**: add the same URL

This makes the "Forgot password?" email link come back to the app.

## On your phone

- Open the URL in Safari, tap **Share → Add to Home Screen** for an app icon.
- Allow location when asked; the moon is then calculated for where you are (the label shows town and ZIP). If location is off, it uses Wellesley, MA.
- iPhone only: tap the compass once and allow motion access so the ring turns as you turn.

## How data is stored

- `entries`: one row per day — `text`, `photos` (list of file paths), `moon` (phase, illumination, rise/set and best day/night times saved with the entry), `updated_at`.
- `photos` bucket (private): `<user id>/<date>/<photo id>.jpg`, shrunk to 1800px JPEG before upload. The app shows them with links that expire after 6 hours.
- Unsaved typing is also kept on the phone until the server confirms the save, so a dropped connection doesn't lose text.
