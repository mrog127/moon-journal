// Moon Journal export: emails the Word document the app just made.
// The app uploads the .docx to your private storage (photos/<user id>/exports/…), then calls this
// function, which makes a 7-day download link and sends it through Resend as an attachment.
// Needs the RESEND_API_KEY secret. Optional: EXPORT_FROM, e.g. "Moon Journal <journal@yourdomain.com>"
// once you've verified a domain in Resend (until then Resend only delivers to your own Resend email).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("Resend");   // either secret name works
const FROM = Deno.env.get("EXPORT_FROM") || "Moon Journal <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    if (!KEY) return json({ error: "The RESEND_API_KEY secret isn't set in Supabase (Edge Functions → Secrets)." }, 500);

    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return json({ error: "Please sign in again, then export." }, 401);

    const { to, path, filename, days, photos, attach } = await req.json();
    if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) return json({ error: "That email address doesn't look right." }, 400);
    if (typeof path !== "string" || !path.startsWith(`${user.id}/exports/`) || !path.endsWith(".docx") || path.includes("..")) {
      return json({ error: "That export file isn't yours." }, 403);
    }
    const name = (String(filename || "Moon Journal.docx").replace(/[^\w .,()-]/g, "").slice(0, 80) || "Moon Journal") .replace(/(\.docx)?$/i, ".docx");

    // A link that works for 7 days. Signed as you, so storage rules still apply.
    const { data: signed, error } = await sb.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error || !signed) return json({ error: "Couldn't find the uploaded document: " + (error?.message || "unknown") }, 404);
    const link = signed.signedUrl;

    const what = `${days} day${days === 1 ? "" : "s"}${photos ? ` and ${photos} photo${photos === 1 ? "" : "s"}` : ""}`;
    const html = `<p>Here's your Moon Journal: ${esc(what)}${attach ? ", attached as a Word document" : ""}.</p>
<p><a href="${esc(link)}">Download ${esc(name)}</a> (link works for 7 days)</p>`;
    const text = `Here's your Moon Journal: ${what}${attach ? ", attached as a Word document" : ""}.\n\nDownload (works for 7 days): ${link}\n`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to.trim()],
        subject: `Moon Journal export (${what})`,
        html, text,
        ...(attach === false ? {} : { attachments: [{ filename: name, path: link }] }),
      }),
    });
    if (!r.ok) {
      const raw = await r.text();
      let msg = raw;
      try { msg = JSON.parse(raw).message || raw; } catch (_) { /* not JSON */ }
      if (r.status === 403 && /own email|verify a domain|testing emails/i.test(msg)) {
        return json({ error: "Resend will only send to the email you signed up to Resend with, until you verify a domain there. Use that address, or verify a domain." }, 400);
      }
      if (r.status === 401) return json({ error: "Resend rejected the API key. Check the RESEND_API_KEY secret." }, 502);
      return json({ error: `Email service error (${r.status}): ${String(msg).slice(0, 200)}` }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Export function error: " + ((e as Error)?.message || String(e)) }, 500);
  }
});
