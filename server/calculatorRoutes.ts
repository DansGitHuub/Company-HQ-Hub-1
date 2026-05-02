import { Express } from "express";
import { pool } from "./db";
import { runCalculator, RunContext } from "./calculators/engine";

// ─── Auth role guard (matches pricingRoutes.ts pattern exactly) ───────────────
function allowedRole(user: any): boolean {
  return (
    user?.role === "Admin" ||
    user?.role === "Manager" ||
    user?.isMasterAdmin === true
  );
}

export function registerCalculatorRoutes(app: Express, requireAuth: any) {

  // ── GET /api/calculators ───────────────────────────────────────────────────
  // Lists all active calculator definitions.  Returns input_schema so the UI
  // can render the form, but NOT formula (kept server-side).
  app.get("/api/calculators", requireAuth, async (req: any, res) => {
    if (!allowedRole(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { rows } = await pool.query(`
        SELECT id, name, display_name, category, description,
               input_schema, sort_order, is_active
        FROM   calculator_definitions
        WHERE  is_active = true
        ORDER  BY sort_order ASC, name ASC
      `);
      return res.json(rows);
    } catch (err: any) {
      console.error("[calculators] GET /api/calculators error:", err);
      return res.status(500).json({ error: "Failed to fetch calculators" });
    }
  });

  // ── GET /api/calculators/:id ───────────────────────────────────────────────
  // Returns a single calculator definition including formula and default_class_id
  // (for admin / tooling use).
  app.get("/api/calculators/:id", requireAuth, async (req: any, res) => {
    if (!allowedRole(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, name, display_name, category, description,
                input_schema, formula, default_class_id, sort_order, is_active
         FROM   calculator_definitions
         WHERE  id = $1`,
        [req.params.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Calculator not found" });
      }
      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[calculators] GET /api/calculators/:id error:", err);
      return res.status(500).json({ error: "Failed to fetch calculator" });
    }
  });

  // ── POST /api/calculators/:id/run ─────────────────────────────────────────
  // Runs a calculator against a set of inputs.
  //
  // Body: {
  //   inputs:                 Record<string, any>  — user-supplied field values
  //   estimate_work_area_id:  string               — target work area for persistence
  //   persist:                boolean              — false = preview only, no DB writes
  // }
  //
  // Response (persist=false): { lineItems, summary }
  // Response (persist=true):  { lineItems (with DB-generated ids), summary, run_id }
  app.post("/api/calculators/:id/run", requireAuth, async (req: any, res) => {
    if (!allowedRole(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const calcId: string = req.params.id;
    const { inputs = {}, estimate_work_area_id, persist = false } = req.body ?? {};

    // ── Load calculator definition ─────────────────────────────────────────
    let defRow: any;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, input_schema, formula, default_class_id, is_active
         FROM   calculator_definitions
         WHERE  id = $1`,
        [calcId]
      );
      if (rows.length === 0 || !rows[0].is_active) {
        return res.status(404).json({ error: "Calculator not found or inactive" });
      }
      defRow = rows[0];
    } catch (err: any) {
      console.error("[calculators] POST run — load definition error:", err);
      return res.status(500).json({ error: "Failed to load calculator definition" });
    }

    // ── Load class_pricing_defaults for the current year ──────────────────
    let classPricingDefaults: RunContext["classPricingDefaults"] = null;
    try {
      const { rows: cpRows } = await pool.query(`
        SELECT class_id, overhead_pct, profit_margin_pct
        FROM   class_pricing_defaults
        WHERE  year = EXTRACT(YEAR FROM NOW())::int
      `);
      if (cpRows.length > 0) {
        classPricingDefaults = new Map(
          cpRows.map((r: any) => [
            Number(r.class_id),
            {
              overhead_pct:      parseFloat(r.overhead_pct),
              profit_margin_pct: parseFloat(r.profit_margin_pct),
            },
          ])
        );
      }
    } catch (err: any) {
      // Non-fatal — engine falls back to raw unit prices without margin markup.
      console.warn("[calculators] Could not load class_pricing_defaults:", err.message);
    }

    // ── Build RunContext from formula top-level fields + DB defaults ────────
    const formula: Record<string, unknown> =
      defRow.formula && typeof defRow.formula === "object"
        ? (defRow.formula as Record<string, unknown>)
        : {};

    const ctx: RunContext = {
      laborRate:
        typeof formula["laborRate"] === "number"
          ? (formula["laborRate"] as number)
          : 65,
      productionRates:
        formula["productionRates"] !== null &&
        typeof formula["productionRates"] === "object"
          ? (formula["productionRates"] as Record<string, number>)
          : {},
      complexityMultipliers:
        formula["complexityMultipliers"] !== null &&
        typeof formula["complexityMultipliers"] === "object"
          ? (formula["complexityMultipliers"] as Record<string, number>)
          : {},
      classPricingDefaults,
    };

    // ── Run the engine ─────────────────────────────────────────────────────
    let result: ReturnType<typeof runCalculator>;
    try {
      result = runCalculator(
        {
          input_schema:     defRow.input_schema,
          formula:          defRow.formula,
          default_class_id: defRow.default_class_id ?? null,
        },
        inputs,
        ctx
      );
    } catch (err: any) {
      // Validation errors from the engine come back as plain Error with a
      // descriptive message — surface them as 400 so the UI can show them.
      const msg: string = err?.message ?? "Calculator engine error";
      console.warn("[calculators] Engine validation/runtime error:", msg);
      return res.status(400).json({ error: msg });
    }

    // ── Preview mode — return without any DB writes ────────────────────────
    if (!persist) {
      return res.json({ lineItems: result.lineItems, summary: result.summary });
    }

    // ── Persist mode — write inside a single transaction ──────────────────
    if (!estimate_work_area_id || typeof estimate_work_area_id !== "string") {
      return res
        .status(400)
        .json({ error: "estimate_work_area_id is required when persist=true" });
    }

    const conn = await pool.connect();
    try {
      await conn.query("BEGIN");

      // Insert one row per line item into estimate_line_items.
      // Use gen_random_uuid() in SQL and RETURNING id so we can hand the
      // caller back IDs they can use to reference / remove items later.
      const lineItemsWithIds: (typeof result.lineItems[number] & { id: string })[] = [];

      for (const li of result.lineItems) {
        const { rows: liRows } = await conn.query(
          `INSERT INTO estimate_line_items
             (id, estimate_work_area_id, item_type, description,
              quantity, unit, unit_price, amount, sort_order, is_optional, class_id)
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            estimate_work_area_id,
            li.item_type,
            li.description,
            li.quantity,
            li.unit,
            li.unit_price,
            li.amount,
            li.sort_order,
            li.is_optional,
            li.class_id ?? null,
          ]
        );
        lineItemsWithIds.push({ ...li, id: liRows[0].id });
      }

      // Record the calculator run for audit / replay.
      const { rows: runRows } = await conn.query(
        `INSERT INTO calculator_runs
           (id, calculator_id, estimate_work_area_id, inputs, output_summary, run_by, run_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, $5, NOW())
         RETURNING id`,
        [
          calcId,
          estimate_work_area_id,
          JSON.stringify(inputs),
          JSON.stringify(result.summary),
          req.user?.id ?? null,
        ]
      );
      const runId: string = runRows[0].id;

      await conn.query("COMMIT");

      return res.json({
        lineItems: lineItemsWithIds,
        summary:   result.summary,
        run_id:    runId,
      });

    } catch (err: any) {
      await conn.query("ROLLBACK").catch(() => {});
      console.error("[calculators] POST run persist transaction error:", err);
      const isDev = process.env.NODE_ENV === "development";
      return res.status(500).json({
        error: isDev ? (err?.message ?? "Transaction failed") : "Failed to persist calculator run",
      });
    } finally {
      conn.release();
    }
  });
}
