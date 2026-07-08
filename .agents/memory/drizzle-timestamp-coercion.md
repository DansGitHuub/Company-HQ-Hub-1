---
name: Drizzle timestamp column coercion
description: Drizzle ORM silently rejects string values for timestamp() columns in .set() — must convert to Date first
---

## Rule
When calling `db.update(table).set(obj)` via Drizzle ORM, any column declared as `timestamp()` in the schema **must** receive a JavaScript `Date` object — not a raw ISO string or YYYY-MM-DD string. Passing a string causes a 500 error with no helpful message (the error goes to stderr, not the [express] logger).

## Symptoms
- PATCH route returns 500 "Error updating candidate" in 12–20ms (too fast for a DB round-trip, suggesting pre-DB failure)
- `console.error` in the catch block doesn't appear in workflow logs (stderr vs stdout split)
- Direct `psql` raw SQL with the same string value works fine

## Fix pattern
Add a sanitize step in the storage function before calling `.set()`:
```typescript
async updateFoo(id: string, updates: Partial<Foo>): Promise<Foo | undefined> {
  const sanitized: any = { ...updates };
  if (sanitized.someTimestampField !== undefined && sanitized.someTimestampField !== null) {
    sanitized.someTimestampField = new Date(sanitized.someTimestampField);
  }
  const [row] = await db.update(fooTable).set(sanitized).where(eq(fooTable.id, id)).returning();
  return row || undefined;
}
```

## How to apply
Any time a PATCH route passes `req.body` directly into a storage update function, scan for `timestamp()` columns in the schema and add coercion for each one. Affects: `candidates.interviewDate`, `candidates.offerAcceptanceExpiresAt`, `candidates.offerAcceptedAt`, `candidates.offerDeclinedAt`, and any other timestamp columns that may be PATCHed from the frontend.

**Why:** Drizzle does not coerce strings to Date objects at runtime for `.set()` even though it does handle them in some query contexts. Raw SQL (pool.query) does coerce them automatically.
