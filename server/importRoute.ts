import { Router } from "express";
import { pool } from "./db";

const IMPORT_SECRET = "chapin-import-2026";

export const importRouter = Router();

importRouter.post("/api/admin/import-customers", async (req, res) => {
  const secret =
    req.headers["x-import-secret"] as string | undefined ||
    req.body?.secret;

  if (secret !== IMPORT_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { customers } = req.body as { customers: any[] };

  if (!Array.isArray(customers) || customers.length === 0) {
    return res.status(400).json({ message: "customers array is required and must not be empty" });
  }

  const results: { index: number; name: string; status: "inserted" | "error"; error?: string }[] = [];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const customerResult = await client.query(
        `INSERT INTO customers
           (first_name, last_name, company_name, billing_address, billing_city,
            billing_state, billing_zip, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          c.first_name ?? null,
          c.last_name ?? null,
          c.company_name ?? null,
          c.billing_address ?? null,
          c.billing_city ?? null,
          c.billing_state ?? null,
          c.billing_zip ?? null,
          c.source ?? null,
          c.notes ?? null,
        ]
      );

      const customerId = customerResult.rows[0].id;

      if (Array.isArray(c.phones)) {
        for (const p of c.phones) {
          await client.query(
            `INSERT INTO customer_phones (customer_id, phone, phone_type, is_primary)
             VALUES ($1, $2, $3, $4)`,
            [customerId, p.phone ?? null, p.phone_type ?? null, p.is_primary ?? false]
          );
        }
      }

      if (Array.isArray(c.emails)) {
        for (const e of c.emails) {
          await client.query(
            `INSERT INTO customer_emails (customer_id, email, email_type, is_primary)
             VALUES ($1, $2, $3, $4)`,
            [customerId, e.email ?? null, e.email_type ?? null, e.is_primary ?? false]
          );
        }
      }

      if (Array.isArray(c.properties)) {
        for (const prop of c.properties) {
          await client.query(
            `INSERT INTO properties (customer_id, address, city, state, zip, property_type, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              customerId,
              prop.address ?? null,
              prop.city ?? null,
              prop.state ?? null,
              prop.zip ?? null,
              prop.property_type ?? null,
              prop.notes ?? null,
            ]
          );
        }
      }

      if (Array.isArray(c.contacts)) {
        for (const ct of c.contacts) {
          await client.query(
            `INSERT INTO customer_contacts (customer_id, first_name, last_name, role, phone, email, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              customerId,
              ct.first_name ?? null,
              ct.last_name ?? null,
              ct.role ?? null,
              ct.phone ?? null,
              ct.email ?? null,
              ct.notes ?? null,
            ]
          );
        }
      }

      await client.query("COMMIT");
      results.push({ index: i, name, status: "inserted" });
    } catch (err: any) {
      await client.query("ROLLBACK");
      results.push({ index: i, name, status: "error", error: err.message });
    } finally {
      client.release();
    }
  }

  const inserted = results.filter((r) => r.status === "inserted").length;
  const errors   = results.filter((r) => r.status === "error").length;

  return res.status(errors > 0 && inserted === 0 ? 500 : 200).json({
    message: `Import complete: ${inserted} inserted, ${errors} failed`,
    inserted,
    errors,
    results,
  });
});
