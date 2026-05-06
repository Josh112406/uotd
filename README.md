# UOTD (Ulam Of The Day)

Minimal MVP using Vercel serverless functions, Supabase Auth + Postgres, and a local PH-focused ulam dataset.

## Setup

1. Create a Supabase project.
2. Run the SQL in [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor.
3. Copy [public/config.example.js](public/config.example.js) to `public/config.js` and fill in your values.
4. (Optional) Add Vercel env vars for serverless functions:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## Run locally

- `npm install`
- `npm run dev`

## Notes

- Ulam data is in [data/ulam.json](data/ulam.json).
- Ingredient price table is in [data/ingredients.json](data/ingredients.json).
- API routes live under [api/](api/).
