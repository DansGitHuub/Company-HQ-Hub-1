import { Express } from "express";
import { syncCustomersPublic } from "./quickbooksSync";
import { pool } from "./db";
import { findCustomerDuplicates } from "./lib/customerDuplicates";
import crypto from "crypto";
import { getAppUrl } from "./emailService";
import { customerArchiveEligibility } from "./services/archiveEligibility";

export function registerCustomerRoutes(app: Express, requireAuth: any) {
  // ─── Schema migration: ensure is_active column exists ───────────────────────
  pool
    .query(
      `
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
  `,
    )
    .catch(() => {});

  // ─── LIST ────────────────────────────────────────────────────────────────────
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const search = (req.query.search as string | undefined)?.trim() ?? "";
      // Only apply a row limit when a search term is provided (to keep autocomplete fast).
      // Without a search param the full list is returned so the customers page works.
      const limitRequested = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : null;
      const limit = search ? Math.min(limitRequested ?? 20, 50) : null; // no limit for full list

      const params: any[] = [];
      const conditions: string[] = [];

      // status filter — default to "active" so existing callers without the param
      // continue to see only active customers
      const status = ((req.query.status as string | undefined) ?? "active").toLowerCase();
      if (status === "active")   conditions.push("c.is_active = true");
      else if (status === "archived") conditions.push("c.is_active = false");
      // "all" → no is_active filter

      if (search) {
        params.push(`%${search}%`);
        const n = params.length; // $n — first positional param
        conditions.push(`(
            c.first_name ILIKE $${n}
            OR c.last_name  ILIKE $${n}
            OR c.company_name ILIKE $${n}
            OR (c.first_name || ' ' || c.last_name) ILIKE $${n}
            OR ce.email ILIKE $${n}
            OR cp.phone ILIKE $${n}
          )`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      let limitClause = "";
      if (limit !== null) {
        params.push(limit);
        limitClause = `LIMIT $${params.length}`;
      }

      const result = await pool.query(
        `
        SELECT
          c.id, c.first_name, c.last_name, c.company_name, c.source,
          c.is_active, c.created_at,
          cp.phone  AS primary_phone,
          ce.email  AS primary_email
        FROM customers c
        LEFT JOIN customer_phones cp ON cp.customer_id = c.id AND cp.is_primary = true
        LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
        ${whereClause}
        ORDER BY c.last_name ASC, c.first_name ASC
        ${limitClause}
      `,
        params,
      );

      return res.json(result.rows);
    } catch (err: any) {
      console.error("[customers] GET /api/customers error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── CREATE ──────────────────────────────────────────────────────────────────
  app.post("/api/customers", requireAuth, async (req, res) => {
    const {
      first_name,
      last_name,
      company_name,
      billing_address,
      billing_city,
      billing_state,
      billing_zip,
      source,
      notes,
      phones = [],
      emails = [],
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim())
      return res
        .status(400)
        .json({ message: "First name and last name are required" });

    // Prevent duplicate customers with the same name
    const dupCheck = await pool.query(
      `SELECT id, first_name, last_name, company_name FROM customers
       WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
       LIMIT 1`,
      [first_name.trim(), last_name.trim()]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        message: `A customer named ${first_name.trim()} ${last_name.trim()} already exists`,
        existing: dupCheck.rows[0],
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO customers
           (first_name, last_name, company_name, billing_address, billing_city,
            billing_state, billing_zip, source, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          first_name.trim(),
          last_name.trim(),
          company_name || null,
          billing_address || null,
          billing_city || null,
          billing_state || null,
          billing_zip || null,
          source || null,
          notes || null,
        ],
      );
      const customerId = result.rows[0].id;
      for (const p of phones) {
        if (p.phone?.trim())
          await client.query(
            `INSERT INTO customer_phones (customer_id, phone, phone_type, is_primary) VALUES ($1,$2,$3,$4)`,
            [customerId, p.phone.trim(), p.phone_type || null, !!p.is_primary],
          );
      }
      for (const e of emails) {
        if (e.email?.trim())
          await client.query(
            `INSERT INTO customer_emails (customer_id, email, email_type, is_primary) VALUES ($1,$2,$3,$4)`,
            [customerId, e.email.trim(), e.email_type || null, !!e.is_primary],
          );
      }
      await client.query("COMMIT");
      syncCustomersPublic().catch((e) =>
        console.error("[QB] customer sync error:", e.message),
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // ─── UPDATE ──────────────────────────────────────────────────────────────────
  app.put("/api/customers/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      company_name,
      billing_address,
      billing_city,
      billing_state,
      billing_zip,
      source,
      notes,
      phones = [],
      emails = [],
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim())
      return res
        .status(400)
        .json({ message: "First name and last name are required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE customers
         SET first_name=$1, last_name=$2, company_name=$3, billing_address=$4,
             billing_city=$5, billing_state=$6, billing_zip=$7, source=$8,
             notes=$9, updated_at=now()
         WHERE id=$10 RETURNING *`,
        [
          first_name.trim(),
          last_name.trim(),
          company_name || null,
          billing_address || null,
          billing_city || null,
          billing_state || null,
          billing_zip || null,
          source || null,
          notes || null,
          id,
        ],
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Customer not found" });
      }
      await client.query(`DELETE FROM customer_phones WHERE customer_id=$1`, [
        id,
      ]);
      await client.query(`DELETE FROM customer_emails WHERE customer_id=$1`, [
        id,
      ]);
      for (const p of phones) {
        if (p.phone?.trim())
          await client.query(
            `INSERT INTO customer_phones (customer_id, phone, phone_type, is_primary) VALUES ($1,$2,$3,$4)`,
            [id, p.phone.trim(), p.phone_type || null, !!p.is_primary],
          );
      }
      for (const e of emails) {
        if (e.email?.trim())
          await client.query(
            `INSERT INTO customer_emails (customer_id, email, email_type, is_primary) VALUES ($1,$2,$3,$4)`,
            [id, e.email.trim(), e.email_type || null, !!e.is_primary],
          );
      }
      await client.query("COMMIT");
      return res.json(result.rows[0]);
    } catch (err: any) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: err.message });
    } finally {
      client.release();
    }
  });

  // ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────
  app.patch("/api/customers/:id/active", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    try {
      const result = await pool.query(
        `UPDATE customers SET is_active=$1, updated_at=now() WHERE id=$2 RETURNING *`,
        [!!is_active, id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Customer not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── DETAIL ──────────────────────────────────────────────────────────────────
  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const customerResult = await pool.query(
        `SELECT * FROM customers WHERE id = $1`,
        [id],
      );
      if (customerResult.rows.length === 0)
        return res.status(404).json({ message: "Customer not found" });
      const customer = customerResult.rows[0];

      const [phones, emails, contacts, properties] = await Promise.all([
        pool.query(
          `SELECT * FROM customer_phones WHERE customer_id=$1 ORDER BY is_primary DESC, created_at ASC`,
          [id],
        ),
        pool.query(
          `SELECT * FROM customer_emails WHERE customer_id=$1 ORDER BY is_primary DESC, created_at ASC`,
          [id],
        ),
        pool.query(
          `SELECT * FROM customer_contacts WHERE customer_id=$1 ORDER BY created_at ASC`,
          [id],
        ),
        pool.query(
          `SELECT * FROM properties WHERE customer_id=$1 ORDER BY created_at ASC`,
          [id],
        ),
      ]);

      return res.json({
        ...customer,
        phones: phones.rows,
        emails: emails.rows,
        contacts: contacts.rows,
        properties: properties.rows,
      });
    } catch (err: any) {
      console.error("[customers] GET /api/customers/:id error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── CUSTOMER JOBS ────────────────────────────────────────────────────────────
  app.get("/api/customers/:id/jobs", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT id, client, type, stage, category, value, scheduled_date, completion_date, created_at
         FROM jobs WHERE customer_id = $1 ORDER BY created_at DESC`,
        [id],
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── DUPLICATE DETECTION ─────────────────────────────────────────────────────
  app.get("/api/customers/:id/duplicates", requireAuth, async (req, res) => {
    try {
      const dupes = await findCustomerDuplicates(req.params.id);
      return res.json(dupes);
    } catch (err: any) {
      console.error("[customers] GET /api/customers/:id/duplicates error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── ARCHIVE / UNARCHIVE ─────────────────────────────────────────────────────
  // Admin, Manager, or Master Admin only. Sets is_active and bumps updated_at.
  function requireAdminOrManager(req: any, res: any): boolean {
    const role: string = req.user?.role ?? "";
    const isMaster: boolean = !!req.user?.isMasterAdmin;
    if (!["Admin", "Manager"].includes(role) && !isMaster) {
      res.status(403).json({ message: "Admin or Manager access required" });
      return false;
    }
    return true;
  }

  // GET /api/customers/:id/archive-eligibility
  // Returns whether the customer can be safely archived and, if not, the list
  // of entity blockers that must be resolved first.
  app.get("/api/customers/:id/archive-eligibility", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id FROM customers WHERE id = $1`,
        [req.params.id],
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "Customer not found" });
      const eligibility = await customerArchiveEligibility(req.params.id);
      return res.json(eligibility);
    } catch (err: any) {
      console.error("[customers] GET /archive-eligibility error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/customers/:id/archive", requireAuth, async (req, res) => {
    if (!requireAdminOrManager(req, res)) return;
    try {
      // Server-side enforcement: reject archiving if blockers exist.
      const eligibility = await customerArchiveEligibility(req.params.id);
      if (!eligibility.canArchive) {
        return res.status(409).json({ blockers: eligibility.blockers });
      }
      const result = await pool.query(
        `UPDATE customers SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
        [req.params.id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Customer not found" });
      return res.json({ id: result.rows[0].id, is_active: false });
    } catch (err: any) {
      console.error("[customers] PATCH /archive error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/customers/:id/unarchive", requireAuth, async (req, res) => {
    if (!requireAdminOrManager(req, res)) return;
    try {
      const result = await pool.query(
        `UPDATE customers SET is_active = true, updated_at = now() WHERE id = $1 RETURNING id`,
        [req.params.id],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Customer not found" });
      return res.json({ id: result.rows[0].id, is_active: true });
    } catch (err: any) {
      console.error("[customers] PATCH /unarchive error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ─── PROPERTY LIST ───────────────────────────────────────────────────────────
  // GET /api/properties?customer_id=&search=
  app.get("/api/properties", requireAuth, async (req, res) => {
    try {
      const customerId =
        (req.query.customer_id as string | undefined)?.trim() ?? "";
      const search = (req.query.search as string | undefined)?.trim() ?? "";

      const params: any[] = [];
      const conditions: string[] = [];

      if (customerId) {
        params.push(customerId);
        conditions.push(`p.customer_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        const n = params.length;
        conditions.push(`(
          p.address ILIKE $${n}
          OR p.city  ILIKE $${n}
          OR p.zip   ILIKE $${n}
          OR (p.address || ' ' || COALESCE(p.city,'')) ILIKE $${n}
        )`);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const { rows } = await pool.query(
        `
        SELECT p.*, c.first_name, c.last_name, c.company_name
        FROM properties p
        LEFT JOIN customers c ON c.id = p.customer_id
        ${where}
        ORDER BY p.address ASC
        LIMIT 50
      `,
        params,
      );

      return res.json(rows);
    } catch (err: any) {
      console.error("[properties] GET /api/properties error:", err.message);
      return res.status(500).json({ message: err.message });
    }
  });

  // ─── PROPERTY CRUD ───────────────────────────────────────────────────────────
  app.post("/api/customers/:id/properties", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { address, city, state, zip, property_type, notes } = req.body;
    if (!address?.trim())
      return res.status(400).json({ message: "Address is required" });
    try {
      const result = await pool.query(
        `INSERT INTO properties (customer_id, address, city, state, zip, property_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          id,
          address.trim(),
          city || null,
          state || null,
          zip || null,
          property_type || null,
          notes || null,
        ],
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/properties/:propId", requireAuth, async (req, res) => {
    const { propId } = req.params;
    const { address, city, state, zip, property_type, notes } = req.body;
    if (!address?.trim())
      return res.status(400).json({ message: "Address is required" });
    try {
      const result = await pool.query(
        `UPDATE properties SET address=$1, city=$2, state=$3, zip=$4,
           property_type=$5, notes=$6, updated_at=now()
         WHERE id=$7 RETURNING *`,
        [
          address.trim(),
          city || null,
          state || null,
          zip || null,
          property_type || null,
          notes || null,
          propId,
        ],
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Property not found" });
      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/properties/:propId", requireAuth, async (req, res) => {
    const { propId } = req.params;
    try {
      await pool.query(`DELETE FROM properties WHERE id=$1`, [propId]);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ── Portal Invite: mint a single-use token for a customer ────────────────────
  app.post("/api/customers/:id/portal-invite", requireAuth, async (req, res) => {
    if (!requireAdminOrManager(req, res)) return;
    const { id } = req.params;
    try {
      // Verify customer exists and has at least one email
      const { rows: custRows } = await pool.query(
        `SELECT c.id, ce.email AS primary_email
         FROM customers c
         LEFT JOIN customer_emails ce ON ce.customer_id = c.id AND ce.is_primary = true
         WHERE c.id = $1`,
        [id]
      );
      if (!custRows.length) return res.status(404).json({ message: "Customer not found" });
      if (!custRows[0].primary_email) {
        // Fall back: any email
        const { rows: anyEmail } = await pool.query(
          `SELECT email FROM customer_emails WHERE customer_id=$1 LIMIT 1`,
          [id]
        );
        if (!anyEmail.length) {
          return res.status(422).json({ message: "Customer has no email address. Add one first." });
        }
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await pool.query(
        `INSERT INTO job_applications
           (token, status, expires_at, expiry_days, created_by, customer_id, data)
         VALUES ($1, 'portal_invite', $2, 1, $3, $4, '{}')`,
        [token, expiresAt.toISOString(), (req as any).user?.id ?? null, id]
      );

      const url = `${getAppUrl()}/portal/customer/${token}`;
      return res.json({ url, expires_at: expiresAt.toISOString() });
    } catch (err: any) {
      console.error("[portal-invite] Error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // ── Portal Invite: redeem a token (public, no auth) ──────────────────────────
  app.get("/api/portal/customer/:token", async (req, res) => {
    const { token } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT id, customer_id, status, expires_at
         FROM job_applications
         WHERE token = $1 AND customer_id IS NOT NULL`,
        [token]
      );
      if (!rows.length) return res.status(404).json({ message: "Invite link not found." });

      const row = rows[0];
      if (row.status === "used") {
        return res.status(410).json({ message: "This invite link has already been used." });
      }
      if (new Date(row.expires_at) < new Date()) {
        return res.status(410).json({ message: "This invite link has expired." });
      }

      // Mark as used (single-use)
      await pool.query(
        `UPDATE job_applications SET status='used', submitted_at=NOW() WHERE id=$1`,
        [row.id]
      );

      // Return redirect target — intentionally excludes sensitive credential fields
      return res.json({ redirect: "/customer-hub", customer_id: row.customer_id });
    } catch (err: any) {
      console.error("[portal-invite] Redeem error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  });
}
