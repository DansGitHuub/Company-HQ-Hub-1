import { pool } from "./db";
import fs from "fs";
import path from "path";

export async function runCustomerDataMigration() {
  try {
    const countResult = await pool.query("SELECT COUNT(*) AS cnt FROM customers");
    const count = parseInt(countResult.rows[0].cnt, 10);

    if (count > 0) {
      console.log(`[customer-data] ${count} customers already in database — skipping seed`);
      return;
    }

    const base = path.resolve(process.cwd(), "server/migrations");
    const customersPath = path.join(base, "customers_data.json");

    if (!fs.existsSync(customersPath)) {
      console.log("[customer-data] Seed files not found, skipping");
      return;
    }

    console.log("[customer-data] Customers table is empty — seeding from JSON files...");

    const customers  = JSON.parse(fs.readFileSync(path.join(base, "customers_data.json"),       "utf-8")) as any[];
    const phones     = JSON.parse(fs.readFileSync(path.join(base, "customer_phones_data.json"), "utf-8")) as any[];
    const emails     = JSON.parse(fs.readFileSync(path.join(base, "customer_emails_data.json"), "utf-8")) as any[];
    const properties = JSON.parse(fs.readFileSync(path.join(base, "properties_data.json"),      "utf-8")) as any[];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const c of customers) {
        await client.query(
          `INSERT INTO customers
             (id, first_name, last_name, company_name, billing_address, billing_city,
              billing_state, billing_zip, source, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.first_name, c.last_name, c.company_name,
           c.billing_address, c.billing_city, c.billing_state, c.billing_zip,
           c.source, c.notes, c.created_at, c.updated_at]
        );
      }

      for (const p of phones) {
        await client.query(
          `INSERT INTO customer_phones
             (id, customer_id, phone, phone_type, is_primary, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.customer_id, p.phone, p.phone_type, p.is_primary, p.created_at]
        );
      }

      for (const e of emails) {
        await client.query(
          `INSERT INTO customer_emails
             (id, customer_id, email, email_type, is_primary, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [e.id, e.customer_id, e.email, e.email_type, e.is_primary, e.created_at]
        );
      }

      for (const p of properties) {
        await client.query(
          `INSERT INTO properties
             (id, customer_id, address, city, state, zip, property_type, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.customer_id, p.address, p.city, p.state, p.zip,
           p.property_type, p.notes, p.created_at, p.updated_at]
        );
      }

      await client.query("COMMIT");
      const after = await pool.query("SELECT COUNT(*) AS cnt FROM customers");
      console.log(`[customer-data] Seeded ${after.rows[0].cnt} customers successfully`);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[customer-data] Rollback — error during seed:", err.message);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[customer-data] Migration error:", err.message);
  }
}
