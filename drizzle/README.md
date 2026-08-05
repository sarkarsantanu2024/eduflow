# Database migrations

The `.sql` files in this folder are the source of truth for the database schema.
They are applied by `scripts/migrate.mjs`, which records each file it has run in
a `_migrations` table so re-running is always a no-op.

```bash
npm run db:migrate            # apply everything outstanding (uses .env.local)
npm run db:migrate -- --dry   # show what would run, change nothing
npm run db:migrate -- 0007    # apply only files matching "0007"
npm run db:migrate:prod       # same, but expects DATABASE_URL already in the env
```

## Rules

**Every migration must be idempotent.** Use `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and wrap constraint
additions in a guarded `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
block. Several databases in the wild were hand-patched before this runner
existed, so a migration may meet objects that already exist.

**Never edit a migration that has shipped.** Add a new one.

**Do not use `npm run db:push` against production.** It diffs `schema.ts`
against the live database and can propose destructive changes; it ignores this
folder entirely. It is a local-development convenience only.

## Adding a migration

1. Edit `src/lib/db/schema.ts`.
2. Either run `npm run db:generate` (drizzle writes the SQL and a snapshot), or
   hand-write the `.sql` file when you need something drizzle-kit cannot express
   — `ALTER TYPE ... ADD VALUE`, guarded constraints, data backfills.
3. Check it with `npm run db:migrate -- --dry`.
4. Apply with `npm run db:migrate`.

## Deploying

Migrations run automatically on **production** deploys. `vercel.json` sets the
build command to `npm run vercel-build`, which is:

```bash
node scripts/migrate.mjs --production-only && next build
```

The environment check lives in `migrate.mjs` rather than in a shell conditional
in `package.json`, because npm runs scripts through `cmd.exe` on Windows — a
POSIX `if [ ... ]` in a script fails for anyone developing on Windows even
though it would work on Vercel's Linux builders.

This exists because for a long time nothing applied migrations at all — which is
how `/admin` came to throw a Server Components error in production for want of
the `capacity_requests` table, while the code that needed it had shipped weeks
earlier.

Two consequences worth knowing:

- **A failed migration fails the deploy.** That is deliberate: shipping code
  against a schema it cannot use is worse than not shipping.
- **`DATABASE_URL` must be exposed at build time**, not just at runtime. If it
  is missing the runner exits with a clear message rather than silently skipping.

### Why preview deploys skip migrations

Preview and production currently point at the **same** database. If previews
migrated, opening a pull request would silently alter the production schema
before the code shipped. So previews build without migrating — which also means
a preview branch containing a new migration runs against the old schema and may
error until it is merged.

The real fix is a separate database (or a Neon branch) per environment. Until
then, treat previews as read-mostly and be careful: a preview deploy is talking
to live customer data.

## `_migrations` vs `meta/_journal.json`

- `_migrations` (a table in the database) is what the runner reads and writes.
  It is authoritative.
- `meta/_journal.json` and `meta/*_snapshot.json` belong to `drizzle-kit`. They
  only matter for `npm run db:generate`.

Snapshots exist for `0000`, `0001` and `0008`. The intermediate ones were never
created because `0002`–`0007` were hand-written, so history cannot be
regenerated — but `0008_snapshot.json` reflects the current schema, so
`db:generate` diffs correctly from here on.

### Baselining an existing database

On a database that predates this runner and is already up to date, record the
history without replaying it:

```bash
npm run db:migrate -- --baseline
```

This inserts every `.sql` filename into `_migrations` and executes nothing.
Needed because `0000_init.sql` and `0001_add_username.sql` are drizzle-generated
`CREATE TYPE` / `CREATE TABLE` statements with no `IF NOT EXISTS` guards —
replaying them on a populated database would error.
