-- Run this SQL in your Supabase SQL Editor to create the necessary tables

CREATE TABLE time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: Since we are not using authentication (login page), we do not need Row Level Security (RLS) linked to users.
-- We can enable RLS and allow anonymous/service_role access if needed, but since you are using a service_role key, it bypasses RLS automatically anyway.
