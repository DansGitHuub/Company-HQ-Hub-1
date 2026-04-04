import { Express } from "express";
import { pool } from "./db";

// ─── Migration ────────────────────────────────────────────────────────────────
async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_budgets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      year INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active')),
      target_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
      work_season_start DATE,
      work_season_end DATE,
      working_days_per_week INT DEFAULT 5,
      production_days INT DEFAULT 174,
      material_markup_percent NUMERIC(5,2) DEFAULT 0,
      equipment_markup_percent NUMERIC(5,2) DEFAULT 0,
      subcontractor_markup_percent NUMERIC(5,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_labor_employees (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      role VARCHAR(100),
      name VARCHAR(255),
      employee_type VARCHAR(10) NOT NULL DEFAULT 'hourly' CHECK (employee_type IN ('hourly','salaried')),
      hourly_wage NUMERIC(10,2) DEFAULT 0,
      annual_salary NUMERIC(12,2) DEFAULT 0,
      total_hours_per_year NUMERIC(8,2) DEFAULT 0,
      unbillable_hours_per_year NUMERIC(8,2) DEFAULT 0,
      overtime_hours NUMERIC(8,2) DEFAULT 0,
      overtime_multiplier NUMERIC(4,2) DEFAULT 1.5,
      bonuses NUMERIC(10,2) DEFAULT 0,
      is_overhead_staff BOOLEAN NOT NULL DEFAULT false,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_materials (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      name VARCHAR(255),
      monthly_cost NUMERIC(12,2) DEFAULT 0,
      annual_cost NUMERIC(12,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_equipment_owned (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      name VARCHAR(255),
      quantity INT DEFAULT 1,
      replacement_cost NUMERIC(12,2) DEFAULT 0,
      useful_life_years NUMERIC(6,2) DEFAULT 1,
      sell_price NUMERIC(12,2) DEFAULT 0,
      is_overhead BOOLEAN NOT NULL DEFAULT true,
      billable_hours_per_year NUMERIC(8,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_equipment_leased (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      name VARCHAR(255),
      quantity INT DEFAULT 1,
      monthly_payment NUMERIC(10,2) DEFAULT 0,
      is_overhead BOOLEAN NOT NULL DEFAULT true,
      billable_hours_per_year NUMERIC(8,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_subcontractors (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      name VARCHAR(255),
      monthly_cost NUMERIC(12,2) DEFAULT 0,
      annual_cost NUMERIC(12,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_overhead_categories (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      name VARCHAR(255),
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_overhead_items (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      category_id INT REFERENCES mors_overhead_categories(id) ON DELETE SET NULL,
      name VARCHAR(255),
      monthly_cost NUMERIC(12,2) DEFAULT 0,
      annual_cost NUMERIC(12,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mors_sales_targets (
      id SERIAL PRIMARY KEY,
      budget_id INT NOT NULL REFERENCES mors_budgets(id) ON DELETE CASCADE,
      division_name VARCHAR(255),
      annual_revenue_target NUMERIC(14,2) DEFAULT 0,
      sort_order INT DEFAULT 0
    )`);

  console.log("[migration] MORS budget tables ready");
}

// ─── Seed 2026 Budget ─────────────────────────────────────────────────────────
async function seed2026(budgetId: number) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    // Hourly field employees: [role, name, wage, total_hrs, unbillable_hrs, ot_hrs, bonus]
    const hourly: [string, string, number, number, number, number, number][] = [
      ["Foreman HS",           "Garrett",      25, 1875, 200, 200, 1000],
      ["Foreman SS",           "Melissa",      25, 1875, 200, 100, 1000],
      ["Crew Member",          "Andrew",       22, 1000, 100, 100,  500],
      ["Crew Member",          "Gabe",         22, 1000, 100, 100,  500],
      ["New Hire",             "Unknown",      22, 1000, 100, 100,  250],
      ["Foreman Maint - H2B",  "Cristobal",   20, 1200, 100, 340,  250],
      ["Tech - H2B",           "Manuel P",    20, 1200, 100, 340,  250],
      ["Tech - H2B",           "Joan",        20, 1200, 100, 340,  250],
      ["Tech - H2B",           "Armando",     20, 1340, 100, 340,  250],
      ["Tech - H2B",           "Manuel D",    20, 1340, 100, 340,  250],
      ["Tech - Amish",         "Emilyn",      22,  475,  50,   0,  100],
      ["Tech - Amish",         "Ester",       22,  475,  50,   0,  100],
      ["Tech - Amish",         "Betty",       22,  475,  50,   0,  100],
      ["Tech - Amish",         "Kathryn",     22,  475,  50,   0,  100],
      ["Early Workers",        "Didn't Last", 25,  650,  25,   0,    0],
      ["Snow",                 "Driver 1",    27,  200,  25,   0,    0],
      ["Snow",                 "Driver 2",    27,  200,  25,   0,    0],
      ["Snow",                 "Driver 3",    27,  200,  25,   0,    0],
      ["Snow",                 "Driver 4",    27,  200,  25,   0,    0],
      ["Snow",                 "Driver 5",    27,  200,  25,   0,    0],
    ];
    for (const [i, [role, name, wage, tot, unbill, ot, bonus]] of hourly.entries()) {
      await c.query(
        `INSERT INTO mors_labor_employees
           (budget_id,role,name,employee_type,hourly_wage,total_hours_per_year,
            unbillable_hours_per_year,overtime_hours,overtime_multiplier,bonuses,
            is_overhead_staff,sort_order)
         VALUES ($1,$2,$3,'hourly',$4,$5,$6,$7,1.5,$8,false,$9)`,
        [budgetId, role, name, wage, tot, unbill, ot, bonus, i]
      );
    }

    // Overhead staff: [role, name, salary, bonus]
    const overhead: [string, string, number, number][] = [
      ["Office Mgr",       "Lindsey",  42000, 0],
      ["Owner Salary",     "Dan",     100000, 0],
      ["Prod Supervisor",  "Matt",     58800, 0],
    ];
    for (const [i, [role, name, salary, bonus]] of overhead.entries()) {
      await c.query(
        `INSERT INTO mors_labor_employees
           (budget_id,role,name,employee_type,annual_salary,total_hours_per_year,
            unbillable_hours_per_year,bonuses,is_overhead_staff,sort_order)
         VALUES ($1,$2,$3,'salaried',$4,2080,0,$5,true,$6)`,
        [budgetId, role, name, salary, bonus, i]
      );
    }

    // Materials: [name, monthly, annual]
    const mats: [string, number, number][] = [
      ["Project Materials (21.75% of Proj Sales)", 22692, 272300],
      ["Snow/Ice Materials (8% of Snow Sales)",     1083,  13000],
      ["Disposal Materials",                          417,   5000],
    ];
    for (const [i, [name, monthly, annual]] of mats.entries()) {
      await c.query(
        `INSERT INTO mors_materials (budget_id,name,monthly_cost,annual_cost,sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [budgetId, name, monthly, annual, i]
      );
    }

    // Equipment owned: [name, qty, replacement_cost, life, sell_price, is_overhead, billable_hrs]
    const owned: [string, number, number, number, number, boolean, number][] = [
      ["Dump Truck Chevy 4500 2020",  1,  90000, 8, 5000, true, 500],
      ["Dump Truck Isuzu NPR 2007",   1,  50000, 8, 5000, true, 500],
      ["Chevy Pickup 2015 3500",      1,  50000, 8, 2500, true, 500],
      ["Chevy Pickup 2017 2500",      1,  50000, 8, 2500, true, 500],
      ["Chevy Pickup 2018 2500",      1,  50000, 8, 2500, true, 500],
      ["Hardscape Trailer",           1,  20000,10, 1000, true, 500],
      ["Softscape Trailer",           1,  15000,10, 1000, true, 500],
      ["Maintenance Trailer",         1,  20000,10, 1000, true, 500],
      ["Flat Trailer",                1,   5000,10,  500, true, 250],
      ["Dump Trailer",                1,  15000, 8, 1500, true, 250],
      ["Excavator 2002 331",          1,  75000,10, 7500, true, 250],
      ["Skid Steer 1995 773",         1,  50000,10, 5000, true, 250],
      ["Mini Track 2005 MT-50",       1,  75000,10, 1500, true, 100],
      ["Boss Snow Plow",              5,  10000, 6, 1000, true, 100],
      ["Harley Rake",                 1,  10000,10, 1000, true,  50],
      ["Rock Hound",                  1,  10000,10, 1000, true,  50],
      ["Blower (Sheffield Loan)",     1,  15100, 8, 2500, true,   0],
      ["Plow (Sheffield Loan)",       1,  10800, 7, 1500, true,   0],
    ];
    for (const [i, [name, qty, rep, life, sell, isOverhead, bhr]] of owned.entries()) {
      await c.query(
        `INSERT INTO mors_equipment_owned
           (budget_id,name,quantity,replacement_cost,useful_life_years,sell_price,
            is_overhead,billable_hours_per_year,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [budgetId, name, qty, rep, life, sell, isOverhead, bhr, i]
      );
    }

    // Equipment leased: [name, qty, monthly, is_overhead]
    const leased: [string, number, number, boolean][] = [
      ["Dump - Dodge Ram 3500",    1, 1350, true],
      ["Equip Rentals",            1,  300, true],
      ["Sheffield - Eby Trailer",  1,  346, true],
      ["Sheffield - Altoz Mower",  1,  464, true],
      ["Bobcat Skid Steer 2023",   1,  933, true],
    ];
    for (const [i, [name, qty, monthly, isOverhead]] of leased.entries()) {
      await c.query(
        `INSERT INTO mors_equipment_leased
           (budget_id,name,quantity,monthly_payment,is_overhead,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [budgetId, name, qty, monthly, isOverhead, i]
      );
    }

    // Subcontractors: [name, monthly, annual]
    const subs: [string, number, number][] = [
      ["CUI",            500,  6000],
      ["ULTRA LAWN",    2500, 30000],
      ["FLOW IRRIGATION", 833, 10000],
      ["DAVEY TREE",     208,  2500],
      ["B & B TREE",     417,  5000],
      ["JC Electric",    417,  5000],
    ];
    for (const [i, [name, monthly, annual]] of subs.entries()) {
      await c.query(
        `INSERT INTO mors_subcontractors (budget_id,name,monthly_cost,annual_cost,sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [budgetId, name, monthly, annual, i]
      );
    }

    // Overhead categories + items: { category: [[name, monthly, annual], ...] }
    const overheadData: { cat: string; items: [string, number, number][] }[] = [
      { cat: "Advertising & Marketing", items: [
        ["6010 Marketing: Advertising + Promos", 417, 5000],
        ["6020 Marketing: Website", 583, 7000],
      ]},
      { cat: "Bank & Financial", items: [
        ["6110 Finance: Interest Expenses", 1667, 20000],
        ["6120 Finance: Bank Fees", 17, 200],
        ["6130 Finance: CC Processing", 2083, 25000],
        ["6140 Finance: Bad Debt", 667, 8000],
      ]},
      { cat: "Equipment & Vehicles", items: [
        ["6810 Vehicle Tags + Permits", 142, 1700],
        ["6820 Fuel Costs (Field)", 3000, 36000],
        ["6830 Repair + Maint (Veh + Equip)", 4167, 50000],
      ]},
      { cat: "Donations", items: [
        ["6360 Charitable Donations", 83, 1000],
      ]},
      { cat: "Overhead Staff", items: [
        ["Labor Burden Total (ER Tax)", 3042, 36500],
      ]},
      { cat: "Professional Services", items: [
        ["6410 Insurances (Equip/Trucks/Property/Liability)", 1833, 22000],
        ["6412 Workers Comp Insurance", 283, 3400],
        ["6413 Health Insurance", 833, 10000],
        ["6420 Accounting", 125, 1500],
        ["6430 Legal", 1667, 20000],
        ["6440 Admin & Business Consulting", 3000, 36000],
        ["6445 HR Expense", 83, 1000],
      ]},
      { cat: "Small Equipment", items: [
        ["6540 Tools & Small Equipment", 417, 5000],
      ]},
      { cat: "Subscriptions & Dues", items: [
        ["6340 Dues & Subscriptions", 208, 2500],
      ]},
      { cat: "Business Development", items: [
        ["6310 Meals & Entertainment", 208, 2500],
        ["6320 Travel", 208, 2500],
        ["6330 Seminars & Education", 1542, 18500],
      ]},
      { cat: "Utilities & Facilities", items: [
        ["6240 Phone & Data Plans", 708, 8500],
        ["6510 Rent", 2754, 33050],
        ["6520 Utilities", 1000, 12000],
      ]},
      { cat: "Admin", items: [
        ["6210 Office Supplies", 250, 3000],
        ["6220 Postage & Delivery", 31, 375],
        ["6251 Software Subscriptions", 2500, 30000],
        ["6260 Uniforms", 625, 7500],
      ]},
      { cat: "Facilities", items: [
        ["6570 Disposal Costs", 83, 1000],
        ["6580 Shop Materials & Consumables", 1375, 16500],
        ["6590 Repairs & Improvements", 833, 10000],
      ]},
      { cat: "Taxes", items: [
        ["6710 Federal & State Taxes", 667, 8000],
        ["6720 Real Estate Taxes", 1000, 12000],
      ]},
    ];

    for (const [ci, { cat, items }] of overheadData.entries()) {
      const { rows: [catRow] } = await c.query(
        `INSERT INTO mors_overhead_categories (budget_id,name,sort_order) VALUES ($1,$2,$3) RETURNING id`,
        [budgetId, cat, ci]
      );
      for (const [ii, [name, monthly, annual]] of items.entries()) {
        await c.query(
          `INSERT INTO mors_overhead_items (budget_id,category_id,name,monthly_cost,annual_cost,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [budgetId, catRow.id, name, monthly, annual, ii]
        );
      }
    }

    // Sales targets: [division, annual]
    const targets: [string, number][] = [
      ["4100 Projects (Hardscape + Softscape)", 1251882],
      ["4300 Maintenance",                        250378],
      ["4400 Snow + Ice",                         166917],
    ];
    for (const [i, [div, target]] of targets.entries()) {
      await c.query(
        `INSERT INTO mors_sales_targets (budget_id,division_name,annual_revenue_target,sort_order)
         VALUES ($1,$2,$3,$4)`,
        [budgetId, div, target, i]
      );
    }

    await c.query("COMMIT");
    console.log("[seed] MORS 2026 budget seeded");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// ─── Calculation Engine ────────────────────────────────────────────────────────
function calculateSummary(budget: any, employees: any[], materials: any[], equipOwned: any[], equipLeased: any[], subs: any[], overheadItems: any[]) {
  const margin = parseFloat(budget.target_margin_percent) / 100;

  // Employee calculations
  const empDetails = employees.map(emp => {
    let total_compensation = 0;
    if (emp.employee_type === "hourly") {
      const regular = parseFloat(emp.hourly_wage) * (parseFloat(emp.total_hours_per_year) - parseFloat(emp.overtime_hours || 0));
      const ot      = parseFloat(emp.hourly_wage) * parseFloat(emp.overtime_multiplier || 1.5) * parseFloat(emp.overtime_hours || 0);
      total_compensation = regular + ot + parseFloat(emp.bonuses || 0);
    } else {
      total_compensation = parseFloat(emp.annual_salary || 0) + parseFloat(emp.bonuses || 0);
    }

    let unbillable_cost = 0;
    let direct_labor_cost = 0;
    if (!emp.is_overhead_staff) {
      const totHrs = parseFloat(emp.total_hours_per_year || 0);
      const unbillHrs = parseFloat(emp.unbillable_hours_per_year || 0);
      if (totHrs > 0) {
        unbillable_cost = total_compensation * (unbillHrs / totHrs);
      }
      direct_labor_cost = total_compensation - unbillable_cost;
    }

    return { ...emp, total_compensation, unbillable_cost, direct_labor_cost };
  });

  const fieldEmps    = empDetails.filter(e => !e.is_overhead_staff);
  const ohStaff      = empDetails.filter(e => e.is_overhead_staff);

  const total_direct_labor       = fieldEmps.reduce((s, e) => s + e.direct_labor_cost, 0);
  const total_unbillable_labor   = fieldEmps.reduce((s, e) => s + e.unbillable_cost, 0);
  const total_overhead_staff_cost= ohStaff.reduce((s, e) => s + e.total_compensation, 0);

  // Only count field staff hours for labor rate calculation
  const total_labor_hours    = fieldEmps.reduce((s, e) => s + parseFloat(e.total_hours_per_year || 0), 0);
  const total_unbillable_hours= fieldEmps.reduce((s, e) => s + parseFloat(e.unbillable_hours_per_year || 0), 0);
  const total_billable_hours = total_labor_hours - total_unbillable_hours;

  const avg_wage       = total_billable_hours > 0 ? total_direct_labor / total_billable_hours : 0;
  // Stored as raw fraction (0–1); multiply by 100 in the UI for display
  const unbillable_pct = total_labor_hours > 0 ? total_unbillable_hours / total_labor_hours : 0;

  // ── Display-only labor rate (blended average across ALL employees × unbillable hrs) ──
  const sum_all_comp  = empDetails.reduce((s, e) => s + e.total_compensation, 0);
  const sum_all_hours = empDetails.reduce((s, e) => s + parseFloat(e.total_hours_per_year || 0), 0);
  const display_unbillable_cost = sum_all_hours > 0 ? (sum_all_comp / sum_all_hours) * total_unbillable_hours : 0;
  const display_total_overhead  = display_unbillable_cost + equipment_overhead_total + additional_overhead;
  const display_breakeven_rate  = total_billable_hours > 0 ? (total_direct_labor + display_total_overhead) / total_billable_hours : 0;
  const display_labor_rate      = (1 - margin) > 0 ? display_breakeven_rate / (1 - margin) : 0;

  // Equipment
  const equipOwnedDetails = equipOwned.map(e => {
    const annual_cost_to_own = (parseFloat(e.replacement_cost) - parseFloat(e.sell_price || 0)) / parseFloat(e.useful_life_years || 1);
    const total_annual_cost  = annual_cost_to_own * parseInt(e.quantity || 1);
    return { ...e, annual_cost_to_own, total_annual_cost };
  });

  const equipLeasedDetails = equipLeased.map(e => {
    const total_annual_cost = parseFloat(e.monthly_payment) * 12 * parseInt(e.quantity || 1);
    return { ...e, total_annual_cost };
  });

  const equipment_overhead_total =
    equipOwnedDetails.filter(e => e.is_overhead).reduce((s, e) => s + e.total_annual_cost, 0) +
    equipLeasedDetails.filter(e => e.is_overhead).reduce((s, e) => s + e.total_annual_cost, 0);

  // Overhead
  const overhead_items_total   = overheadItems.reduce((s, i) => s + parseFloat(i.annual_cost || 0), 0);
  const additional_overhead    = overhead_items_total + total_overhead_staff_cost;
  const total_overhead         = total_unbillable_labor + equipment_overhead_total + additional_overhead;

  // COGS
  const total_materials        = materials.reduce((s, m) => s + parseFloat(m.annual_cost || 0), 0);
  const total_subcontractors   = subs.reduce((s, s2) => s + parseFloat(s2.annual_cost || 0), 0);
  const total_cogs             = total_direct_labor + total_materials + total_subcontractors;

  // Revenue & rates
  const total_costs            = total_cogs + total_overhead;
  const required_revenue       = margin < 1 ? total_costs / (1 - margin) : total_costs;
  const net_profit             = required_revenue * margin;
  const breakeven_rate         = total_billable_hours > 0 ? (total_direct_labor + total_overhead) / total_billable_hours : 0;
  const labor_rate             = (1 - margin) > 0 ? breakeven_rate / (1 - margin) : 0;
  const overhead_markup_on_labor_pct = total_direct_labor > 0 ? (total_overhead / total_direct_labor) * 100 : 0;

  return {
    employee_details: empDetails,
    equipment_owned_details: equipOwnedDetails,
    equipment_leased_details: equipLeasedDetails,
    total_direct_labor, total_unbillable_labor, total_overhead_staff_cost,
    total_labor_hours, total_unbillable_hours, total_billable_hours,
    avg_wage, unbillable_pct,
    equipment_overhead_total, overhead_items_total, additional_overhead, total_overhead,
    total_materials, total_subcontractors, total_cogs,
    total_costs, required_revenue, net_profit,
    net_margin_pct: parseFloat(budget.target_margin_percent),
    breakeven_rate, labor_rate, overhead_markup_on_labor_pct,
    display_labor_rate, display_breakeven_rate,
  };
}

// ─── Load full budget data ─────────────────────────────────────────────────────
async function loadBudgetData(budgetId: string | number) {
  const [
    { rows: [budget] },
    { rows: employees },
    { rows: materials },
    { rows: equipOwned },
    { rows: equipLeased },
    { rows: subs },
    { rows: overheadCats },
    { rows: overheadItems },
    { rows: salesTargets },
  ] = await Promise.all([
    pool.query("SELECT * FROM mors_budgets WHERE id=$1", [budgetId]),
    pool.query("SELECT * FROM mors_labor_employees WHERE budget_id=$1 ORDER BY is_overhead_staff, sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_materials WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_equipment_owned WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_equipment_leased WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_subcontractors WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_overhead_categories WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_overhead_items WHERE budget_id=$1 ORDER BY category_id, sort_order", [budgetId]),
    pool.query("SELECT * FROM mors_sales_targets WHERE budget_id=$1 ORDER BY sort_order", [budgetId]),
  ]);
  return { budget, employees, materials, equipOwned, equipLeased, subs, overheadCats, overheadItems, salesTargets };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function registerMorsRoutes(app: Express, requireAuth: any, requireAdmin: any) {
  await migrate();

  // Seed 2026 budget if none exists
  const { rows: existing } = await pool.query("SELECT id FROM mors_budgets LIMIT 1");
  if (existing.length === 0) {
    const { rows: [b] } = await pool.query(
      `INSERT INTO mors_budgets (name,year,status,target_margin_percent,work_season_start,work_season_end,working_days_per_week,production_days)
       VALUES ('2026 Budget (V2) Final',2026,'active',15,'2026-04-01','2026-11-30',5,174) RETURNING id`
    );
    await seed2026(b.id);
  }

  // ── GET /api/mors/budgets ──────────────────────────────────────────────────
  app.get("/api/mors/budgets", requireAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM mors_budgets ORDER BY year DESC, name");
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /api/mors/budgets ─────────────────────────────────────────────────
  app.post("/api/mors/budgets", requireAdmin, async (req, res) => {
    const { name, year, status, target_margin_percent, work_season_start, work_season_end, working_days_per_week, production_days } = req.body;
    try {
      const { rows: [b] } = await pool.query(
        `INSERT INTO mors_budgets (name,year,status,target_margin_percent,work_season_start,work_season_end,working_days_per_week,production_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, year, status || "draft", target_margin_percent ?? 15, work_season_start || null, work_season_end || null, working_days_per_week ?? 5, production_days ?? 174]
      );
      res.status(201).json(b);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /api/mors/budgets/:id ──────────────────────────────────────────────
  app.get("/api/mors/budgets/:id", requireAdmin, async (req, res) => {
    try {
      const data = await loadBudgetData(req.params.id);
      if (!data.budget) return res.status(404).json({ error: "Budget not found" });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── PUT /api/mors/budgets/:id ──────────────────────────────────────────────
  app.put("/api/mors/budgets/:id", requireAdmin, async (req, res) => {
    const { name, year, status, target_margin_percent, work_season_start, work_season_end, working_days_per_week, production_days, material_markup_percent, equipment_markup_percent, subcontractor_markup_percent } = req.body;
    try {
      const { rows: [b] } = await pool.query(
        `UPDATE mors_budgets SET name=$1,year=$2,status=$3,target_margin_percent=$4,work_season_start=$5,work_season_end=$6,
         working_days_per_week=$7,production_days=$8,material_markup_percent=$9,equipment_markup_percent=$10,
         subcontractor_markup_percent=$11,updated_at=NOW() WHERE id=$12 RETURNING *`,
        [name, year, status, target_margin_percent, work_season_start || null, work_season_end || null, working_days_per_week, production_days, material_markup_percent ?? 0, equipment_markup_percent ?? 0, subcontractor_markup_percent ?? 0, req.params.id]
      );
      if (!b) return res.status(404).json({ error: "Not found" });
      res.json(b);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── DELETE /api/mors/budgets/:id ──────────────────────────────────────────
  app.delete("/api/mors/budgets/:id", requireAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM mors_budgets WHERE id=$1", [req.params.id]);
      res.status(204).end();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /api/mors/budgets/:id/summary ─────────────────────────────────────
  app.get("/api/mors/budgets/:id/summary", requireAdmin, async (req, res) => {
    try {
      const { budget, employees, materials, equipOwned, equipLeased, subs, overheadItems } = await loadBudgetData(req.params.id);
      if (!budget) return res.status(404).json({ error: "Not found" });
      const summary = calculateSummary(budget, employees, materials, equipOwned, equipLeased, subs, overheadItems);
      res.json(summary);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Employees ──────────────────────────────────────────────────────────────
  app.post("/api/mors/budgets/:id/employees", requireAdmin, async (req, res) => {
    const bid = req.params.id;
    const { role, name, employee_type, hourly_wage, annual_salary, total_hours_per_year, unbillable_hours_per_year, overtime_hours, overtime_multiplier, bonuses, is_overhead_staff } = req.body;
    try {
      const { rows: [e] } = await pool.query(
        `INSERT INTO mors_labor_employees (budget_id,role,name,employee_type,hourly_wage,annual_salary,total_hours_per_year,unbillable_hours_per_year,overtime_hours,overtime_multiplier,bonuses,is_overhead_staff)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [bid, role, name, employee_type || "hourly", hourly_wage ?? 0, annual_salary ?? 0, total_hours_per_year ?? 0, unbillable_hours_per_year ?? 0, overtime_hours ?? 0, overtime_multiplier ?? 1.5, bonuses ?? 0, is_overhead_staff ?? false]
      );
      res.status(201).json(e);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/mors/budgets/:id/employees/:eid", requireAdmin, async (req, res) => {
    const { role, name, employee_type, hourly_wage, annual_salary, total_hours_per_year, unbillable_hours_per_year, overtime_hours, overtime_multiplier, bonuses, is_overhead_staff } = req.body;
    try {
      const { rows: [e] } = await pool.query(
        `UPDATE mors_labor_employees SET role=$1,name=$2,employee_type=$3,hourly_wage=$4,annual_salary=$5,total_hours_per_year=$6,unbillable_hours_per_year=$7,overtime_hours=$8,overtime_multiplier=$9,bonuses=$10,is_overhead_staff=$11
         WHERE id=$12 AND budget_id=$13 RETURNING *`,
        [role, name, employee_type, hourly_wage ?? 0, annual_salary ?? 0, total_hours_per_year ?? 0, unbillable_hours_per_year ?? 0, overtime_hours ?? 0, overtime_multiplier ?? 1.5, bonuses ?? 0, is_overhead_staff ?? false, req.params.eid, req.params.id]
      );
      if (!e) return res.status(404).json({ error: "Not found" });
      res.json(e);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/mors/budgets/:id/employees/:eid", requireAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM mors_labor_employees WHERE id=$1 AND budget_id=$2", [req.params.eid, req.params.id]);
      res.status(204).end();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Materials ──────────────────────────────────────────────────────────────
  const simpleCrud = (table: string, idField: string) => {
    app.post(`/api/mors/budgets/:id/${idField}`, requireAdmin, async (req, res) => {
      const cols = Object.keys(req.body).filter(k => k !== "id" && k !== "budget_id");
      const vals = cols.map(k => req.body[k]);
      try {
        const { rows: [r] } = await pool.query(
          `INSERT INTO ${table} (budget_id,${cols.join(",")}) VALUES ($1,${vals.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,
          [req.params.id, ...vals]
        );
        res.status(201).json(r);
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.put(`/api/mors/budgets/:id/${idField}/:itemId`, requireAdmin, async (req, res) => {
      const cols = Object.keys(req.body).filter(k => k !== "id" && k !== "budget_id");
      const vals = cols.map(k => req.body[k]);
      try {
        const { rows: [r] } = await pool.query(
          `UPDATE ${table} SET ${cols.map((c,i)=>`${c}=$${i+1}`).join(",")} WHERE id=$${cols.length+1} AND budget_id=$${cols.length+2} RETURNING *`,
          [...vals, req.params.itemId, req.params.id]
        );
        if (!r) return res.status(404).json({ error: "Not found" });
        res.json(r);
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });

    app.delete(`/api/mors/budgets/:id/${idField}/:itemId`, requireAdmin, async (req, res) => {
      try {
        await pool.query(`DELETE FROM ${table} WHERE id=$1 AND budget_id=$2`, [req.params.itemId, req.params.id]);
        res.status(204).end();
      } catch (e: any) { res.status(500).json({ error: e.message }); }
    });
  };

  simpleCrud("mors_materials",          "materials");
  simpleCrud("mors_equipment_owned",    "equipment-owned");
  simpleCrud("mors_equipment_leased",   "equipment-leased");
  simpleCrud("mors_subcontractors",     "subcontractors");
  simpleCrud("mors_overhead_items",     "overhead-items");
  simpleCrud("mors_sales_targets",      "sales-targets");

  // ── Overhead categories ─────────────────────────────────────────────────────
  app.post("/api/mors/budgets/:id/overhead-categories", requireAdmin, async (req, res) => {
    try {
      const { rows: [r] } = await pool.query(
        "INSERT INTO mors_overhead_categories (budget_id,name,sort_order) VALUES ($1,$2,$3) RETURNING *",
        [req.params.id, req.body.name, req.body.sort_order ?? 0]
      );
      res.status(201).json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/mors/budgets/:id/overhead-categories/:catId", requireAdmin, async (req, res) => {
    try {
      const { rows: [r] } = await pool.query(
        "UPDATE mors_overhead_categories SET name=$1 WHERE id=$2 AND budget_id=$3 RETURNING *",
        [req.body.name, req.params.catId, req.params.id]
      );
      if (!r) return res.status(404).json({ error: "Not found" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/mors/budgets/:id/overhead-categories/:catId", requireAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM mors_overhead_categories WHERE id=$1 AND budget_id=$2", [req.params.catId, req.params.id]);
      res.status(204).end();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
