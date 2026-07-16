---
name: index.ts pool import
description: server/index.ts does not import pool by default; any inline migration block added there must import it explicitly.
---

## Rule
When adding a `pool.query(...)` migration block directly inside `server/index.ts`, you must also add:

```typescript
import { pool } from "./db";
```

to the top of that file, because it is not imported there by default.

**Why:** The existing migration functions (`runEquipmentMigration`, etc.) bring their own `pool` import inside their own files. `index.ts` itself only imports them as functions, so it has no `pool` in scope unless explicitly added.

**How to apply:** Any time you add a raw `await pool.query(...)` block in the main IIFE of `server/index.ts`, check for the import and add it if missing.
