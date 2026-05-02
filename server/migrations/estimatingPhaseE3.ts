import { pool } from "../db";

export async function runEstimatingPhaseE3Migration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ─── Update mowing_time description to use {token} interpolation ───
    await client.query(`
      UPDATE calculator_definitions
      SET description = 'Mowing service per visit ({lawn_sqft} sq ft, {complexity} complexity, {service_level} service)'
      WHERE name = 'mowing_time';
    `);

    // ─── Seed: bed_maintenance ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'bed_maintenance',
        'Bed Maintenance',
        'maintenance',
        'Bed maintenance per visit ({bed_sqft} sq ft, {maintenance_level} level)',
        '{"inputs":[{"name":"bed_sqft","label":"Total bed area (sq ft)","type":"number","min":0,"default":500},{"name":"maintenance_level","label":"Maintenance level","type":"select","default":"standard","options":[{"value":"light","label":"Light 1.0x"},{"value":"standard","label":"Standard 1.25x"},{"value":"heavy","label":"Heavy 1.5x"}]},{"name":"visits_per_season","label":"Visits per season","type":"number","min":1,"default":12},{"name":"service_level","label":"Service level","type":"select","default":"standard","options":[{"value":"standard","label":"Standard"},{"value":"premium","label":"Premium"}]}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"productionRates":{"standard":600,"premium":500},"complexityMultipliers":{"light":1.0,"standard":1.25,"heavy":1.5},"lineItems":[{"item_type":"service","class_id":1,"description":"Bed maintenance per visit ({bed_sqft} sq ft, {maintenance_level} level)","qtyExpr":"visits_per_season","unitPriceExpr":"(bed_sqft / productionRates[service_level]) * laborRate * complexityMultipliers[maintenance_level]","unit":"visit","is_optional":false,"sort_order":0}]}'::jsonb,
        1,
        true,
        2
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // ─── Seed: edge_time ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'edge_time',
        'Edge Time',
        'maintenance',
        'Edging per visit ({linear_feet} lf, {edge_type})',
        '{"inputs":[{"name":"linear_feet","label":"Linear feet to edge","type":"number","min":0,"default":200},{"name":"edge_type","label":"Edge type","type":"select","default":"simple","options":[{"value":"simple","label":"Simple straight"},{"value":"curved","label":"Curved or intricate"}]},{"name":"visits_per_season","label":"Visits per season","type":"number","min":1,"default":28}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"productionRates":{"simple":3600,"curved":2400},"lineItems":[{"item_type":"service","class_id":1,"description":"Edging per visit ({linear_feet} lf, {edge_type})","qtyExpr":"visits_per_season","unitPriceExpr":"(linear_feet / productionRates[edge_type]) * laborRate","unit":"visit","is_optional":false,"sort_order":0}]}'::jsonb,
        1,
        true,
        3
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // ─── Seed: lawn_fertilizer (multi-class: Materials + Labor) ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'lawn_fertilizer',
        'Lawn Fertilizer',
        'maintenance',
        'Lawn fertilizer materials and application',
        '{"inputs":[{"name":"lawn_sqft","label":"Lawn area (sq ft)","type":"number","min":0,"default":10000},{"name":"applications_per_season","label":"Applications per season","type":"number","min":1,"default":4}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"materialRatePer1000sqft":4.50,"applicationRateSqftPerHour":20000,"lineItems":[{"item_type":"material","class_id":3,"description":"Fertilizer materials per application ({lawn_sqft} sq ft)","qtyExpr":"applications_per_season","unitPriceExpr":"(lawn_sqft / 1000) * materialRatePer1000sqft","unit":"application","is_optional":false,"sort_order":0},{"item_type":"service","class_id":1,"description":"Fertilizer application labor ({lawn_sqft} sq ft)","qtyExpr":"applications_per_season","unitPriceExpr":"(lawn_sqft / applicationRateSqftPerHour) * laborRate","unit":"application","is_optional":false,"sort_order":1}]}'::jsonb,
        3,
        true,
        4
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // ─── Seed: push_time (snow plow) ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'push_time',
        'Snow Push Time',
        'snow',
        'Snow plowing per push ({driveway_sqft} sq ft, {service_level} service)',
        '{"inputs":[{"name":"driveway_sqft","label":"Driveway and lot area (sq ft)","type":"number","min":0,"default":3000},{"name":"events_per_season","label":"Events per season","type":"number","min":1,"default":18},{"name":"service_level","label":"Service level","type":"select","default":"standard","options":[{"value":"standard","label":"Standard"},{"value":"premium","label":"Premium"}]}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"productionRates":{"standard":4000,"premium":3000},"lineItems":[{"item_type":"service","class_id":1,"description":"Snow plowing per push ({driveway_sqft} sq ft, {service_level} service)","qtyExpr":"events_per_season","unitPriceExpr":"(driveway_sqft / productionRates[service_level]) * laborRate","unit":"push","is_optional":false,"sort_order":0}]}'::jsonb,
        1,
        true,
        5
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // ─── Seed: salt_application (multi-class: Materials + Labor) ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'salt_application',
        'Salt Application',
        'snow',
        'Salt materials and application labor per event',
        '{"inputs":[{"name":"surface_sqft","label":"Surface area to salt (sq ft)","type":"number","min":0,"default":3000},{"name":"salt_rate_lb_per_1000sqft","label":"Salt rate (lb per 1000 sq ft)","type":"number","min":0,"default":12},{"name":"salt_cost_per_lb","label":"Salt cost ($ per lb)","type":"number","min":0,"default":0.18},{"name":"events_per_season","label":"Events per season","type":"number","min":1,"default":12},{"name":"minutes_per_application","label":"Application labor (minutes per event)","type":"number","min":0,"default":15}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"lineItems":[{"item_type":"material","class_id":3,"description":"Salt materials per event ({surface_sqft} sq ft, {salt_rate_lb_per_1000sqft} lb per 1000)","qtyExpr":"events_per_season","unitPriceExpr":"(surface_sqft / 1000) * salt_rate_lb_per_1000sqft * salt_cost_per_lb","unit":"event","is_optional":false,"sort_order":0},{"item_type":"service","class_id":1,"description":"Salt application labor ({minutes_per_application} min per event)","qtyExpr":"events_per_season","unitPriceExpr":"(minutes_per_application / 60) * laborRate","unit":"event","is_optional":false,"sort_order":1}]}'::jsonb,
        3,
        true,
        6
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    // ─── Seed: walks_time (snow walks clearing) ───
    await client.query(`
      INSERT INTO calculator_definitions (
        id, name, display_name, category, description,
        input_schema, formula, default_class_id, is_active, sort_order
      ) VALUES (
        gen_random_uuid(),
        'walks_time',
        'Walks Clearing Time',
        'snow',
        'Walk clearing per event ({walk_linear_feet} lf)',
        '{"inputs":[{"name":"walk_linear_feet","label":"Walk linear feet to clear","type":"number","min":0,"default":100},{"name":"events_per_season","label":"Events per season","type":"number","min":1,"default":18}]}'::jsonb,
        '{"type":"decomposed","laborRate":65,"productionRateLfPerHour":200,"lineItems":[{"item_type":"service","class_id":1,"description":"Walk clearing per event ({walk_linear_feet} lf)","qtyExpr":"events_per_season","unitPriceExpr":"(walk_linear_feet / productionRateLfPerHour) * laborRate","unit":"event","is_optional":false,"sort_order":0}]}'::jsonb,
        1,
        true,
        7
      )
      ON CONFLICT (name) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("[migration] Estimating Phase E3 calculators ready (mowing_time description updated, 6 new seeds inserted)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
