-- Rate limiting for sign-in and sign-up (src/lib/rate-limit.ts).
--
-- In Postgres rather than in memory: the app runs as many short-lived
-- serverless instances, and a counter that lives in one of them is reset by
-- the next. One row per key ("login:user:<name>", "login:ip:<addr>",
-- "signup:ip:<addr>"); a fixed window that restarts when it expires.

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key"          text PRIMARY KEY,
  "count"        integer NOT NULL,
  "window_start" timestamp with time zone NOT NULL DEFAULT now()
);
