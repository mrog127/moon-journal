// Moon Journal reminders. Runs every 5 minutes (scheduled in Supabase) and sends:
//   • "day"     at the best daytime moon time
//   • "night"   at the best night moon time, when that's in the evening before 10pm
//   • "journal" at 10pm, unless that day's entry is already written
// Each subscription is checked in its own time zone and location.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";
import SunCalc from "npm:suncalc@1.9.0";

const JOURNAL_MIN = 22 * 60;   // 10pm
const WINDOW_MIN = 10;         // send if the time passed within the last 10 minutes
const SITE = "https://mrog127.github.io/moon-journal/";

// ---------- Time zone helpers ----------
function parts(d: Date, tz: string) {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d)) p[x.type] = x.value;
  return p;
}
export function localNow(d: Date, tz: string) {
  const p = parts(d, tz);
  return { key: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
function offsetMs(d: Date, tz: string) {
  const p = parts(d, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
}
export function atLocal(key: string, minutes: number, tz: string) {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

// ---------- Moon math (same rules as the app) ----------
const RAD = Math.PI / 180;
const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const cardinal = (b: number) => POINTS[Math.round(b / 22.5) % 16];
function phaseName(p: number) {
  if (p < 0.0339 || p >= 0.9661) return "New Moon";
  if (p < 0.216) return "Waxing Crescent";
  if (p < 0.284) return "First Quarter";
  if (p < 0.466) return "Waxing Gibbous";
  if (p < 0.534) return "Full Moon";
  if (p < 0.716) return "Waning Gibbous";
  if (p < 0.784) return "Last Quarter";
  return "Waning Crescent";
}
type Sample = { m: number; alt: number; bearing: number; sunAlt: number; frac: number; phase: number; elong: number };
export function bestTimes(key: string, tz: string, lat: number, lng: number) {
  const samples: Sample[] = [];
  for (let m = 0; m <= 1440; m += 5) {
    const d = atLocal(key, m, tz);
    const p = SunCalc.getMoonPosition(d, lat, lng);
    const s = SunCalc.getPosition(d, lat, lng);
    const ill = SunCalc.getMoonIllumination(d);
    const alt = p.altitude / RAD, bearing = ((p.azimuth / RAD) + 540) % 360;
    const sunAlt = s.altitude / RAD, sunBearing = ((s.azimuth / RAD) + 540) % 360;
    const c = Math.sin(alt * RAD) * Math.sin(sunAlt * RAD) + Math.cos(alt * RAD) * Math.cos(sunAlt * RAD) * Math.cos((bearing - sunBearing) * RAD);
    samples.push({ m, alt, bearing, sunAlt, frac: ill.fraction, phase: ill.phase, elong: Math.acos(Math.max(-1, Math.min(1, c))) / RAD });
  }
  const waking = (s: Sample) => s.m >= 540 && s.m <= 1380;
  const highest = (l: Sample[]) => l.reduce<Sample | null>((a, b) => (!a || b.alt > a.alt + 0.01 ? b : a), null);
  const first = (...ls: Sample[][]) => ls.find((l) => l.length) || [];
  const daylight = samples.filter((s) => s.sunAlt > 0);
  const goodDay = (s: Sample) => s.alt > 10 && s.elong > 20;
  const day = highest(first(daylight.filter((s) => waking(s) && goodDay(s)), daylight.filter(goodDay), daylight.filter((s) => s.alt > 0), daylight));
  let dark = samples.filter((s) => s.sunAlt < -6);
  if (!dark.length) dark = samples.filter((s) => s.sunAlt < 0);
  const evening = (s: Sample) => s.m >= 720 && s.m <= 1380;
  const night = highest(first(dark.filter((s) => evening(s) && s.alt > 10), dark.filter((s) => s.alt > 10), dark.filter((s) => s.alt > 0), dark));
  return { day, night };
}
const fmt = (m: number) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`; };
function moonMessage(kind: "day" | "night", s: Sample, key: string) {
  return {
    title: kind === "day" ? "Daytime moon, look now" : "Best moon view tonight",
    body: `Look ${Math.round(s.bearing)}° ${cardinal(s.bearing)}, ${Math.round(s.alt)}° up. ${phaseName(s.phase)}, ${Math.round(s.frac * 100)}% lit.`,
    tag: `${kind}-${key}`,
    url: `${SITE}?date=${key}&open=${kind}`,
  };
}

// ---------- Handler ----------
if (import.meta.main) {
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || SITE, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

  Deno.serve(async (req) => {
    const secret = Deno.env.get("CRON_SECRET");
    if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });
    const test = new URL(req.url).searchParams.get("test") === "1";

    const { data: subs, error } = await supa.from("push_subscriptions").select("*");
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const now = new Date();
    let sent = 0;
    const notes: string[] = [];
    for (const s of subs ?? []) {
      const tz = s.tz || "America/New_York";
      const { key, minutes } = localNow(now, tz);
      const prefs = s.prefs || {};
      const jobs: { kind: string; at: number; msg: Record<string, string> }[] = [];

      if (test) {
        jobs.push({ kind: "test-" + now.toISOString(), at: minutes, msg: { title: "Moon Journal", body: "Reminders are working.", tag: "test", url: SITE } });
      } else {
        const b = bestTimes(key, tz, s.lat ?? 42.2985, s.lng ?? -71.284);
        // Only remind when the Moon is actually up and clear of the horizon.
        if (prefs.day !== false && b.day && b.day.alt > 5) jobs.push({ kind: "day", at: b.day.m, msg: moonMessage("day", b.day, key) });
        if (prefs.night !== false && b.night && b.night.alt > 5 && b.night.m >= 720 && b.night.m < JOURNAL_MIN)
          jobs.push({ kind: "night", at: b.night.m, msg: moonMessage("night", b.night, key) });
        if (prefs.journal !== false)
          jobs.push({ kind: "journal", at: JOURNAL_MIN, msg: { title: "Moon Journal", body: "How did the moon look today? Add tonight's entry.", tag: `journal-${key}`, url: `${SITE}?date=${key}` } });
      }

      for (const j of jobs) {
        if (!test && (minutes < j.at || minutes >= j.at + WINDOW_MIN)) continue;
        if (j.kind === "journal") {
          const { data: e } = await supa.from("entries").select("date").eq("user_id", s.user_id).eq("date", key).maybeSingle();
          if (e) { notes.push(`journal skipped, ${key} already written`); continue; }
        }
        // The log has one row per subscription, kind and day, so nothing is sent twice.
        const { error: dupe } = await supa.from("push_log").insert({ subscription_id: s.id, kind: j.kind, date: key });
        if (dupe) continue;
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(j.msg), { TTL: 60 * 60 });
          sent++;
          notes.push(`sent ${j.kind} at ${fmt(minutes)} ${tz}`);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await supa.from("push_subscriptions").delete().eq("id", s.id);   // phone unsubscribed
          notes.push(`failed ${j.kind}: ${code ?? (err as Error).message}`);
        }
      }
    }
    return Response.json({ checked: subs?.length ?? 0, sent, notes });
  });
}
