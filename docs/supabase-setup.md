# Supabase Setup

Merchplace uses Supabase for off-chain listing metadata, image storage, user profiles, shipping tracking, and listing event logs. The on-chain listing still has to be verified before the API writes a live listing to Supabase.

## 1. Copy Project Keys

Open Supabase Dashboard > Project Settings > API and copy:

- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- anon public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role secret key -> `SUPABASE_SERVICE_ROLE_KEY`

Put them in `app/.env.local`, then restart the Next.js dev server.

## 2. Create Tables And Policies

Open Supabase SQL Editor and run:

```sql
-- Paste the full contents of app/supabase/schema.sql
```

That creates:

- `users`
- `listings`
- `shipping`
- `listing_events`
- RLS policies for public reads and service-role writes
- a public `listing-images` storage bucket

## 3. Confirm Image Storage

The schema creates the bucket through SQL. In Supabase Storage, confirm:

- Name: `listing-images`
- Visibility: public
- Max file size: 5 MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`

The app stores listing photos there and saves public image URLs in `listings.images`.

## 4. Verify Connection

From `app/`, run:

```bash
npm run supabase:check
```

Expected result:

```text
Config: ready
DNS: OK
Tables:
- OK users
- OK listings
- OK shipping
- OK listing_events
Storage:
- OK listing-images (public)
Supabase: connected
```

If the check says the project host cannot be resolved, replace `NEXT_PUBLIC_SUPABASE_URL` and both keys with fresh values from Supabase Dashboard > Project Settings > API.
