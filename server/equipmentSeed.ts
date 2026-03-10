import { db } from "./db";
import { oemMaintenanceTemplates } from "@shared/schema";

const templates = [
  { brand: "Exmark", category: "Mower", taskName: "Engine Oil & Filter Change", taskDescription: "Replace engine oil and oil filter per OEM specs", hoursInterval: 100, calendarIntervalDays: 180, priorityLevel: "p2" },
  { brand: "Exmark", category: "Mower", taskName: "Air Filter Replacement", taskDescription: "Replace primary and secondary air filter elements", hoursInterval: 200, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Spark Plug Replacement", taskDescription: "Replace spark plugs and check gap", hoursInterval: 300, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Hydraulic Fluid & Filter", taskDescription: "Replace hydraulic fluid and filter", hoursInterval: 500, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Exmark", category: "Mower", taskName: "Blade Sharpening", taskDescription: "Sharpen or replace mower blades", hoursInterval: 25, calendarIntervalDays: 14, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Grease All Fittings", taskDescription: "Grease all zerk fittings including spindles, caster pivots, and idler arms", hoursInterval: 50, calendarIntervalDays: 30, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Belt Inspection & Replacement", taskDescription: "Inspect drive and deck belts for wear, cracking, or stretching", hoursInterval: 500, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Fuel Filter Replacement", taskDescription: "Replace inline fuel filter", hoursInterval: 200, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Exmark", category: "Mower", taskName: "Tire Pressure Check", taskDescription: "Check and adjust all tire pressures per spec", hoursInterval: 50, calendarIntervalDays: 14, priorityLevel: "p4" },
  { brand: "Exmark", category: "Mower", taskName: "Battery Inspection", taskDescription: "Check battery terminals, clean corrosion, verify charge", hoursInterval: null, calendarIntervalDays: 90, priorityLevel: "p4" },

  { brand: "Kubota", category: "Tractor", taskName: "Engine Oil & Filter Change", taskDescription: "Replace engine oil and filter per Kubota specs", hoursInterval: 200, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Kubota", category: "Tractor", taskName: "Fuel Filter Replacement", taskDescription: "Replace primary and secondary fuel filters", hoursInterval: 400, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Kubota", category: "Tractor", taskName: "Air Filter Service", taskDescription: "Clean or replace outer and inner air filter elements", hoursInterval: 200, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Kubota", category: "Tractor", taskName: "Hydraulic Oil & Filter", taskDescription: "Replace hydraulic oil and filter", hoursInterval: 600, calendarIntervalDays: 730, priorityLevel: "p2" },
  { brand: "Kubota", category: "Tractor", taskName: "Coolant System Service", taskDescription: "Flush and replace coolant, inspect hoses and clamps", hoursInterval: null, calendarIntervalDays: 730, priorityLevel: "p3" },
  { brand: "Kubota", category: "Tractor", taskName: "Transmission Oil Change", taskDescription: "Replace transmission/rear axle oil", hoursInterval: 600, calendarIntervalDays: 730, priorityLevel: "p2" },
  { brand: "Kubota", category: "Tractor", taskName: "Grease All Fittings", taskDescription: "Grease all grease points including loader, 3-point hitch, and steering", hoursInterval: 50, calendarIntervalDays: 30, priorityLevel: "p3" },
  { brand: "Kubota", category: "Tractor", taskName: "Fan Belt Inspection", taskDescription: "Check fan/alternator belt tension and condition", hoursInterval: 200, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Kubota", category: "Tractor", taskName: "Battery & Electrical Check", taskDescription: "Check battery, clean terminals, verify alternator output", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p4" },
  { brand: "Kubota", category: "Tractor", taskName: "Tire & Wheel Nut Check", taskDescription: "Inspect tires, check pressures, re-torque wheel nuts", hoursInterval: null, calendarIntervalDays: 90, priorityLevel: "p4" },

  { brand: "Stihl", category: "Handheld", taskName: "Air Filter Cleaning", taskDescription: "Clean or replace air filter element", hoursInterval: 25, calendarIntervalDays: 14, priorityLevel: "p3" },
  { brand: "Stihl", category: "Handheld", taskName: "Spark Plug Replacement", taskDescription: "Replace spark plug", hoursInterval: 100, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "Stihl", category: "Handheld", taskName: "Fuel Filter Replacement", taskDescription: "Replace in-tank fuel filter", hoursInterval: 100, calendarIntervalDays: 180, priorityLevel: "p3" },
  { brand: "Stihl", category: "Handheld", taskName: "Trimmer Line / Chain Replacement", taskDescription: "Replace cutting attachment as needed", hoursInterval: 50, calendarIntervalDays: 30, priorityLevel: "p4" },
  { brand: "Stihl", category: "Handheld", taskName: "Exhaust Screen Cleaning", taskDescription: "Clean muffler screen/spark arrestor to prevent carbon buildup", hoursInterval: 75, calendarIntervalDays: 90, priorityLevel: "p3" },
  { brand: "Stihl", category: "Handheld", taskName: "Starter Cord Inspection", taskDescription: "Inspect recoil starter cord for fraying, replace if worn", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p4" },

  { brand: "Ford", category: "Truck", taskName: "Engine Oil & Filter Change", taskDescription: "Replace engine oil and filter per manufacturer interval", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p2", notes: "Every 7,500 miles or 6 months" },
  { brand: "Ford", category: "Truck", taskName: "Tire Rotation", taskDescription: "Rotate tires per manufacturer pattern", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p3", notes: "Every 7,500 miles" },
  { brand: "Ford", category: "Truck", taskName: "Brake Inspection", taskDescription: "Inspect brake pads, rotors, calipers, and lines", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Ford", category: "Truck", taskName: "Transmission Fluid Service", taskDescription: "Replace transmission fluid and filter", hoursInterval: null, calendarIntervalDays: 1095, priorityLevel: "p3", notes: "Every 30,000 miles or 3 years" },
  { brand: "Ford", category: "Truck", taskName: "Coolant Flush", taskDescription: "Flush and replace engine coolant", hoursInterval: null, calendarIntervalDays: 730, priorityLevel: "p3" },
  { brand: "Ford", category: "Truck", taskName: "Air Filter Replacement", taskDescription: "Replace engine air filter", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p3", notes: "Every 15,000-30,000 miles" },
  { brand: "Ford", category: "Truck", taskName: "DEF Fluid Top-Off", taskDescription: "Check and fill diesel exhaust fluid", hoursInterval: null, calendarIntervalDays: 90, priorityLevel: "p3", notes: "Diesel engines only" },
  { brand: "Ford", category: "Truck", taskName: "Battery & Charging System", taskDescription: "Test battery, clean terminals, check alternator", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p4" },

  { brand: "GM", category: "Truck", taskName: "Engine Oil & Filter Change", taskDescription: "Replace engine oil and filter per manufacturer interval", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p2", notes: "Every 7,500 miles or 6 months" },
  { brand: "GM", category: "Truck", taskName: "Tire Rotation", taskDescription: "Rotate tires per manufacturer pattern", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p3" },
  { brand: "GM", category: "Truck", taskName: "Brake Inspection", taskDescription: "Inspect brake pads, rotors, and fluid level", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "GM", category: "Truck", taskName: "Transmission Fluid Service", taskDescription: "Replace transmission fluid", hoursInterval: null, calendarIntervalDays: 1460, priorityLevel: "p3", notes: "Every 45,000 miles" },
  { brand: "GM", category: "Truck", taskName: "Air Filter Replacement", taskDescription: "Replace engine air filter", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p3" },
  { brand: "GM", category: "Truck", taskName: "Coolant Flush", taskDescription: "Flush and replace coolant", hoursInterval: null, calendarIntervalDays: 730, priorityLevel: "p3" },

  { brand: "Ram", category: "Truck", taskName: "Engine Oil & Filter Change", taskDescription: "Replace engine oil and filter", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p2", notes: "Every 10,000 miles or 6 months" },
  { brand: "Ram", category: "Truck", taskName: "Tire Rotation", taskDescription: "Rotate tires per pattern", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p3" },
  { brand: "Ram", category: "Truck", taskName: "Brake Inspection", taskDescription: "Inspect brakes, pads, rotors", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Ram", category: "Truck", taskName: "Transmission Service", taskDescription: "Replace transmission fluid and filter", hoursInterval: null, calendarIntervalDays: 1095, priorityLevel: "p3" },
  { brand: "Ram", category: "Truck", taskName: "Transfer Case Fluid", taskDescription: "Replace transfer case fluid (4WD models)", hoursInterval: null, calendarIntervalDays: 1095, priorityLevel: "p3" },
  { brand: "Ram", category: "Truck", taskName: "Air Filter Replacement", taskDescription: "Replace engine air filter element", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p3" },

  { brand: "Generic", category: "Trailer", taskName: "Wheel Bearing Repack", taskDescription: "Repack wheel bearings with grease, inspect races and seals", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p2", notes: "Annual or every 12,000 miles" },
  { brand: "Generic", category: "Trailer", taskName: "Brake Inspection & Adjustment", taskDescription: "Inspect brake shoes/pads, adjust as needed, check magnets", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p2" },
  { brand: "Generic", category: "Trailer", taskName: "Tire Inspection", taskDescription: "Check tread depth, condition, and pressures on all tires including spare", hoursInterval: null, calendarIntervalDays: 90, priorityLevel: "p3" },
  { brand: "Generic", category: "Trailer", taskName: "Lights & Electrical Check", taskDescription: "Verify all lights, connectors, and breakaway system", hoursInterval: null, calendarIntervalDays: 90, priorityLevel: "p3" },
  { brand: "Generic", category: "Trailer", taskName: "Coupler & Safety Chain Inspection", taskDescription: "Inspect coupler mechanism, safety chains, and jack", hoursInterval: null, calendarIntervalDays: 180, priorityLevel: "p3" },
  { brand: "Generic", category: "Trailer", taskName: "Frame & Structural Inspection", taskDescription: "Check frame for cracks, rust, or damage. Inspect floor/deck", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p4" },
  { brand: "Generic", category: "Trailer", taskName: "Registration Renewal", taskDescription: "Renew trailer registration before expiration", hoursInterval: null, calendarIntervalDays: 365, priorityLevel: "p1" },
];

export async function seedOemTemplates() {
  try {
    const existing = await db.select().from(oemMaintenanceTemplates);
    if (existing.length > 0) {
      console.log(`[seed] OEM templates already seeded (${existing.length} templates)`);
      return;
    }

    for (const tmpl of templates) {
      await db.insert(oemMaintenanceTemplates).values(tmpl);
    }
    console.log(`[seed] Seeded ${templates.length} OEM maintenance templates`);
  } catch (err) {
    console.error("[seed] Failed to seed OEM templates:", err);
  }
}
