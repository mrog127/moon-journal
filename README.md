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

## Reminders (push notifications)

The app can remind you at the best daytime moon time, at the best night moon time (when that's before 10pm), and at 10pm to write the day's entry (skipped if you already have). Supabase sends them every 5 minutes on a schedule, using the location and time zone your phone last reported.

| File | What it is |
|---|---|
| `sw.js` | Service worker: shows reminders and opens the app when you tap one |
| `manifest.webmanifest`, `icons/` | Home Screen app name and icons |
| `supabase/reminders.sql` | Tables for phones that subscribed and a log so nothing sends twice |
| `supabase/functions/send-reminders/index.ts` | The function that works out the times and sends the reminders |
| `.reminder-secrets.txt` | Your private keys and the schedule SQL. On your Mac only, never pushed |

One-time setup:
1. **SQL Editor**: run `supabase/reminders.sql`.
2. **Edge Functions → Deploy a new function → Via Editor**: name it `send-reminders`, paste `supabase/functions/send-reminders/index.ts`, deploy. In the function's settings, turn **off** "Verify JWT" (the schedule uses its own secret instead).
3. **Edge Functions → Secrets**: add the four values from `.reminder-secrets.txt`.
4. **SQL Editor**: run the schedule SQL from `.reminder-secrets.txt`.
5. Push the site, open Moon Journal **from your Home Screen**, tap the calendar → **Reminders** → **Turn on reminders**, and allow notifications.
6. Optional test: run the `curl` line in `.reminder-secrets.txt`; a "Reminders are working" notification should arrive.

## Dictation

On a day with no entry, tap **Dictate**, talk, then **Stop recording**. The app records your voice (the line follows the sound of it). When you stop, the `clean-dictation` function sends the recording to OpenAI, which transcribes it and then cleans it up: filler words out ("um", "uh", "like", "so"), spoken corrections applied ("scratch that", "new paragraph"), nothing reworded. The text drops into the entry for editing.

One-time setup:
1. Create an OpenAI API key at platform.openai.com/api-keys and add a few dollars of credit (a minute of dictation costs well under a cent).
2. **Edge Functions → Deploy a new function → Via Editor**: name it `clean-dictation`, paste `supabase/functions/clean-dictation/index.ts`, deploy. Leave **Verify JWT on** (only you, signed in, can use it).
3. **Edge Functions → Secrets**: add `OPENAI_API_KEY` with your key.

Optional secrets to change models: `TRANSCRIBE_MODEL` (default `gpt-4o-mini-transcribe`) and `CLEANUP_MODEL` (default `gpt-4.1-mini`).
