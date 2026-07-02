---
name: No production DB credentials available
description: What access to the production database actually exists in this environment, and a known drizzle-kit toolchain issue when trying to introspect a clone.
---

- There is no production database connection string, Neon branch/API tool, or any other
  way to get direct `psql`/`pg_dump` access to production in this environment. The only
  handle to production is the sandboxed `executeSql({ environment: "production" })` tool,
  which allows read-only `SELECT` queries against a replica — no DDL, no dump.
- `DATABASE_URL` (and `pg_dump`/`pg_restore`/`psql` binaries, which are available on
  the system) only ever point at the **development** database (host `helium`).
- To inspect production's actual catalog state (column defaults, index defs, etc.)
  read-only, query `pg_catalog`/`information_schema` directly via `executeSql` with
  `environment: "production"` — this is more precise and far lower-risk than trying to
  build a full clone, and is usually sufficient on its own.
- If you need to see how `drizzle-kit pull` would serialize a database's actual schema
  (e.g. to compare against `schema.ts`), you can `pg_dump --schema-only` the dev database
  into a local scratch Postgres instance (`initdb` + `pg_ctl start` on a throwaway port,
  e.g. 5433, socket dir `/tmp`) and run `drizzle-kit pull` against that — this never
  touches production.
- **Known blocker**: in this repo, the installed `drizzle-kit` (v0.31.8) fails on `pull`
  with `ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './gel-core' is not defined by
  "exports" in drizzle-orm/package.json` — an upstream drizzle-kit/drizzle-orm version
  incompatibility (drizzle-kit's bin eagerly loads a Gel-dialect serializer that isn't
  exported by the installed drizzle-orm version), unrelated to any actual schema issue.
  Installing a separate drizzle-kit/drizzle-orm via `npm install` also isn't possible
  from the `bash` tool (blocked; requires the packager tool). Fall back to direct
  `pg_catalog` queries instead of relying on `drizzle-kit pull` output in this repo.
- Each `bash` tool call appears to run in a fresh process context — a Postgres server
  started with `pg_ctl start` in one `bash` call will *not* still be running in the next
  `bash` call. Do all setup + work + teardown for an ephemeral local Postgres inside a
  single `bash` invocation.
