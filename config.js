// Fill these in from Supabase → Project Settings → API.
// The anon key is safe to publish: the database rules only let a signed-in
// person read and write their own journal.
window.MOON_CONFIG = {
  supabaseUrl: "https://zbylvawfgxkuigkpkhus.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieWx2YXdmZ3hrdWlna3BraHVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMjE3MTgsImV4cCI6MjEwODU5NzcxOH0.M22JOAoC9w_4AxlDtNAr3oiMLNrYq45AWSDZRL0ij4U",
  // Public key for reminders (safe to publish; the private half is only in Supabase).
  vapidPublicKey: "BLZH9I17JnrhaAxSWTqxoKXWbtuvB46hE1Vl1lfijIYNYxnSdhWAbuRWqbd8PuVvzADv4tyZtzQyizr5rcyV3Vs",
};
