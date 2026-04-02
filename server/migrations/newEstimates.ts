import { pool } from "../db";

export async function runNewEstimatesMigration() {
  // Sequence for estimate numbers
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS sales_estimate_seq START 1`);

  // Main estimates table (named sales_estimates to avoid conflict with legacy pipeline table)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_estimates (
      id                    VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
      estimate_number       VARCHAR(50)    UNIQUE,
      customer_id           VARCHAR(36)    REFERENCES customers(id) ON DELETE SET NULL,
      property_id           VARCHAR(36)    REFERENCES properties(id) ON DELETE SET NULL,
      estimate_type         VARCHAR(50)    NOT NULL DEFAULT 'project',
      template_name         VARCHAR(100),
      title                 VARCHAR(200)   NOT NULL DEFAULT 'New Estimate',
      status                VARCHAR(30)    NOT NULL DEFAULT 'draft',
      salesperson_id        VARCHAR(36)    REFERENCES users(id) ON DELETE SET NULL,
      valid_until           DATE,
      issued_date           DATE           NOT NULL DEFAULT CURRENT_DATE,
      subtotal              DECIMAL(10,2)  NOT NULL DEFAULT 0,
      tax_rate              DECIMAL(5,4)   NOT NULL DEFAULT 0,
      tax_amount            DECIMAL(10,2)  NOT NULL DEFAULT 0,
      discount_amount       DECIMAL(10,2)  NOT NULL DEFAULT 0,
      total                 DECIMAL(10,2)  NOT NULL DEFAULT 0,
      down_payment_percent  DECIMAL(5,2)   NOT NULL DEFAULT 0,
      down_payment_amount   DECIMAL(10,2)  NOT NULL DEFAULT 0,
      notes                 TEXT,
      customer_message      TEXT,
      terms                 TEXT,
      customer_response     TEXT,
      customer_response_at  TIMESTAMPTZ,
      customer_response_note TEXT,
      sent_at               TIMESTAMPTZ,
      viewed_at             TIMESTAMPTZ,
      converted_at          TIMESTAMPTZ,
      converted_job_id      VARCHAR(36)    REFERENCES jobs(id) ON DELETE SET NULL,
      created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );
  `);

  // Work areas within an estimate (grouped line items)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estimate_work_areas (
      id                 VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
      estimate_id        VARCHAR(36)   NOT NULL REFERENCES sales_estimates(id) ON DELETE CASCADE,
      name               VARCHAR(100)  NOT NULL,
      work_area_type_id  VARCHAR(36)   REFERENCES work_area_types(id) ON DELETE SET NULL,
      sort_order         INTEGER       NOT NULL DEFAULT 0
    );
  `);

  // Line items within each work area
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estimate_line_items (
      id                   VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
      estimate_work_area_id VARCHAR(36)   NOT NULL REFERENCES estimate_work_areas(id) ON DELETE CASCADE,
      item_type            VARCHAR(20)    NOT NULL DEFAULT 'service',
      description          TEXT           NOT NULL,
      quantity             DECIMAL(10,2)  NOT NULL DEFAULT 1,
      unit                 VARCHAR(30),
      unit_price           DECIMAL(10,2)  NOT NULL DEFAULT 0,
      amount               DECIMAL(10,2)  NOT NULL DEFAULT 0,
      sort_order           INTEGER        NOT NULL DEFAULT 0,
      is_optional          BOOLEAN        NOT NULL DEFAULT false
    );
  `);

  // Reusable estimate templates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estimate_templates (
      id                     VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name                   VARCHAR(100)  NOT NULL,
      estimate_type          VARCHAR(50)   NOT NULL,
      description            TEXT,
      default_work_areas     JSONB,
      default_terms          TEXT,
      default_customer_message TEXT,
      is_active              BOOLEAN       NOT NULL DEFAULT true,
      created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  // Seed starter templates if none exist
  const { rows } = await pool.query(`SELECT COUNT(*) FROM estimate_templates`);
  if (parseInt(rows[0].count) === 0) {
    const maintenanceAreas = JSON.stringify([
      { name: "Mowing",        line_items: [{ item_type: "service", description: "Lawn mowing", quantity: 1, unit: "visit", unit_price: 0 }] },
      { name: "Trimming",      line_items: [{ item_type: "service", description: "Trimming and edging", quantity: 1, unit: "visit", unit_price: 0 }] },
      { name: "Edging",        line_items: [{ item_type: "service", description: "Bed edging", quantity: 1, unit: "lf", unit_price: 0 }] },
      { name: "Fertilization", line_items: [{ item_type: "material", description: "Fertilizer application", quantity: 1, unit: "application", unit_price: 0 }] },
    ]);
    const projectAreas = JSON.stringify([
      { name: "Site Prep / Grading", line_items: [{ item_type: "labor", description: "Site preparation and grading", quantity: 1, unit: "hr", unit_price: 0 }] },
      { name: "Planting",            line_items: [{ item_type: "material", description: "Plant material", quantity: 1, unit: "each", unit_price: 0 }] },
      { name: "Mulching",            line_items: [{ item_type: "material", description: "Mulch installation", quantity: 1, unit: "yard", unit_price: 0 }] },
    ]);
    const snowAreas = JSON.stringify([
      { name: "Snow Plowing",     line_items: [{ item_type: "service", description: "Per push plowing", quantity: 1, unit: "push", unit_price: 0 }] },
      { name: "Salting",          line_items: [{ item_type: "material", description: "Salt/deicer application", quantity: 1, unit: "application", unit_price: 0 }] },
      { name: "Sidewalk Clearing", line_items: [{ item_type: "service", description: "Sidewalk hand clearing", quantity: 1, unit: "hr", unit_price: 0 }] },
    ]);

    await pool.query(
      `INSERT INTO estimate_templates (name, estimate_type, description, default_work_areas, default_terms, default_customer_message) VALUES
       ($1, $2, $3, $4::jsonb, $5, $6),
       ($7, $8, $9, $10::jsonb, $11, $12),
       ($13, $14, $15, $16::jsonb, $17, $18)`,
      [
        "Maintenance Contract", "maintenance_contract",
        "Recurring lawn maintenance including mowing, trimming, edging, and fertilization.",
        maintenanceAreas,
        "Payment is due within 15 days of invoice. Monthly billing cycle. 30-day written notice required to cancel.",
        "Thank you for considering Chapin Landscapes for your lawn maintenance needs. Please review the scope of work below and let us know if you have any questions.",

        "Landscape Project", "project",
        "Custom landscape installation project including site prep, planting, and mulching.",
        projectAreas,
        "A 50% deposit is required before work begins. Remaining balance due upon project completion.",
        "We're excited to transform your outdoor space! Please review this proposal and feel free to reach out with any questions or modifications.",

        "Snow & Ice Contract", "snow_contract",
        "Seasonal snow and ice management including plowing, salting, and sidewalk clearing.",
        snowAreas,
        "Seasonal contract runs November 1 – April 1. Monthly billing. Services performed per trigger depth unless otherwise specified.",
        "Thank you for choosing Chapin Landscapes for snow and ice management. Please review the service details below.",
      ]
    );
    console.log("[migration] estimate_templates seeded with 3 starter templates");
  }

  console.log("[migration] Sales estimates tables ready");
}
