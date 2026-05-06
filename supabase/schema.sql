create extension if not exists "pgcrypto";

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  budget_per_meal numeric,
  kcal_target integer,
  diet_tags text[] default '{}'
);

create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ingredient_name text not null,
  quantity numeric default 0,
  unit text default '',
  updated_at timestamptz default now()
);

create table if not exists saved_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  mode text check (mode in ('daily', 'weekly')),
  suggestion_date date default current_date,
  ulam_ids text[] default '{}',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table pantry_items enable row level security;
alter table saved_suggestions enable row level security;

create policy "Profiles are user owned" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Pantry is user owned" on pantry_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Suggestions are user owned" on saved_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
