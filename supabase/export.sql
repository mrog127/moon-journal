-- Moon Journal export: run once in Supabase → SQL Editor → New query → Run.
-- Lets the app save the exported Word document next to your photos (in your own private folder),
-- and raises the size limit so a journal with lots of photos fits (50 MB, the free-plan maximum).
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    file_size_limit = 52428800
where id = 'photos';
