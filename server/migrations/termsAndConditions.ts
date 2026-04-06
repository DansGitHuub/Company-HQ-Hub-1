import { pool } from "../db";

const INSTALL_TC = `SCOPE: Chapin Landscapes (the Contractor) shall furnish all materials, tools, equipment, and labor necessary to execute the installation in the applicable drawing(s) and defined on the accompanying proposal/scope of work. Any substantial change to the scope of this work must be in writing and approved by both parties.

WORKMANSHIP: All operations shall be completed in a substantial and workmanlike manner. Drawings and details are to serve as a guide.

REVISION: This proposal is subject to revision unless accepted within 30 days, as the availability of many materials is not constant. This proposal is based on the current price of labor and materials and may be adjusted after 30 days to account for any unanticipated price increases and or material availability.

BILLING AND COLLECTION: The Contractor's invoices are due upon receipt unless stated otherwise. The Contractor shall charge the Customer a minimum fee of $50 for any check returned for insufficient funds. Late payments will be subject to a finance charge at the periodic rate of two percent (2%) per month (which is an annual rate of 24%). In addition, late payment shall constitute a breach of this Agreement and entitle the Contractor to immediately terminate this Agreement. The Customer agrees to indemnify and hold harmless the Contractor from and against all claims, damages, losses and expenses arising out of or resulting from such termination. No payments shall be made to any employee of the Contractor other than through official invoices. If any collection service, legal action or other proceeding is necessary to collect past due amounts, the Customer agrees to be responsible for all fees associated with the collection of the delinquent amount, including but not limited to court costs and reasonable legal fees.

CONCEALED CONTINGENCIES: This proposal is subject to extra charges for concealed contingencies, including but not limited to rock, debris, poor drainage situations, sub-surface soil conditions, sprinkler systems and/or other utilities and debris, hidden piping, etc., not readily apparent when estimating the material and work specified. The Contractor is not responsible for the cost of any additional work caused by damage to any such pre-existing or unknown conditions. It is the sole responsibility of the Customer to bear these costs. The site shall be received by the Contractor in a finished grade that is properly drained and in a clean, workable condition unless otherwise stated in the contract.

GUARANTEE: The Contractor guarantees quality of workmanship and installation methods for one year from installation date, but does not guarantee plants, trees, products, materials, or finishes beyond any warranty provided by the supplier or manufacturer. The Contractor is not responsible for labor, delivery, or installation costs associated with manufacturer defects. This Guarantee does not cover normal reactions such as fine cracks in concrete, checking or warping of wood, settling of soil, or acts of God. This Guarantee is void if the Customer fails to maintain the installation per Contractor recommendations.

MAINTENANCE: The Customer shall begin maintenance of plants, seeding, and turf immediately after installation. Failure to provide adequate maintenance shall void the Guarantee.

MATERIALS: The Contractor shall supply all materials as specified but shall have the right to substitute materials of equal or higher value when necessary. The Customer is responsible for preventing theft of materials after placement on site.

CHANGES: Substantial alterations to the approved contract must be in writing and will be charged at the Contractor's normal selling price.

UNAVOIDABLE INTERRUPTIONS: The Contractor shall not be held responsible for any loss, damage, or delay caused by weather, strikes, or other causes beyond the Contractor's control.

PROPERTY LINES: The Customer is responsible for the location of all property lines and corners.

DAMAGE: The Contractor will contact Ohio Utility Protection Service to mark all known utility lines. The Contractor will make reasonable efforts to avoid any property damage. The Customer is responsible for marking private lines including but not limited to underground objects, including invisible fences, gas and water lines, electric, cable, telephone wires or conduits, sidewalks or drives, or other objects to avoid. The Contractor will not assume responsibility for any damages to any unmarked objects unless designated on appropriate drawings or physical markings before the start of work.

OPPORTUNITY TO REPAIR: The Contractor shall have no liability for any damage to Customer's property unless (a) the Customer gives the Contractor notice of the damage within three (3) business days of its occurrence, and (b) the Customer affords the Contractor a reasonable opportunity to repair or replace the damaged item. The Contractor will not be liable for any indirect or consequential damage. Regardless of any damage, or other obligation of the Contractor, the Customer shall not be entitled to withhold any payment due to the Contractor hereunder.

PERMITS: All necessary zoning, building, and construction permits shall be paid for by the Customer. Additional time may be billed for permit acquisition. Delays in zoning and permit issuance may delay the project and are beyond the Contractor's control.

LIMITATION OF LIABILITY: The Contractor's liability hereunder, or arising from the work contemplated by this Agreement, shall not exceed the compensation paid to the Contractor under this Agreement. The Contractor shall not be liable for (a) lost profits or other indirect damages, (b) damage to property which results, in whole or in part, from a lack of proper maintenance, pets, deterioration of materials, improper initial workmanship, or any other cause beyond the Contractor's control, or (c) any injury to person or property alleged to have arisen from the Services if the Services were performed properly.

ARBITRATION: Any controversy or claim arising out of or in any way related to this Contract or the breach thereof shall be settled by binding arbitration before a single arbitrator in accordance with the construction industry's arbitration rules of the American Arbitration Association and judgment upon the decision and/or award rendered by the arbitrator may be entered in any court having jurisdiction thereof. The arbitration and demand, therefore, shall be submitted to the office of the American Arbitration Association directly serving the Greater Cleveland area. All expenses and costs associated with the arbitration, demand, and filing thereof shall be the responsibility of the losing party. In no event may a demand for arbitration be made after the date when the institution of legal or equitable proceedings could be brought by the applicable statute of limitations.`;

export async function runTermsAndConditionsMigration() {
  try {
    // Create terms_and_conditions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS terms_and_conditions (
        id          VARCHAR(36)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
        type        TEXT          NOT NULL,
        title       TEXT          NOT NULL,
        content     TEXT          NOT NULL DEFAULT '',
        is_active   BOOLEAN       NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ   DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   DEFAULT NOW()
      )
    `);

    // Seed the three T&C types if not already present
    await pool.query(`
      INSERT INTO terms_and_conditions (type, title, content)
      SELECT 'install', 'Install Project Terms & Conditions', $1
      WHERE NOT EXISTS (SELECT 1 FROM terms_and_conditions WHERE type='install')
    `, [INSTALL_TC]);

    await pool.query(`
      INSERT INTO terms_and_conditions (type, title, content)
      SELECT 'maintenance', 'Maintenance Service Terms & Conditions', ''
      WHERE NOT EXISTS (SELECT 1 FROM terms_and_conditions WHERE type='maintenance')
    `);

    await pool.query(`
      INSERT INTO terms_and_conditions (type, title, content)
      SELECT 'snow', 'Snow Removal Terms & Conditions', ''
      WHERE NOT EXISTS (SELECT 1 FROM terms_and_conditions WHERE type='snow')
    `);

    // Add columns to sales_estimates
    await pool.query(`
      ALTER TABLE sales_estimates
        ADD COLUMN IF NOT EXISTS terms_and_conditions_override TEXT,
        ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 50,
        ADD COLUMN IF NOT EXISTS initials TEXT,
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ
    `);

    // Add columns to invoices (no FK since types may differ)
    await pool.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS estimate_id TEXT,
        ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(50) DEFAULT 'standard'
    `);

    console.log("[migration] Terms & Conditions tables and columns ready");
  } catch (err: any) {
    console.error("[migration] T&C migration error:", err.message);
  }
}
