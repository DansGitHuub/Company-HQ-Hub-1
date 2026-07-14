import CsvImportPage from "@/components/csv-import/CsvImportPage";

export default function MaintenanceRoutesImport() {
  return (
    <CsvImportPage
      title="Import Maintenance Routes"
      description="Upload a CSV to bulk-import routes and their stops. Routes are matched by name (case-insensitive) and updated if they already exist. Stops are matched by route + property address."
      expectedColumns={[
        { name: "Route Name",       required: true,  description: "Route name — used for dedup matching and grouping stops" },
        { name: "Address",          required: true,  description: "Property street address — matched against existing properties" },
        { name: "Sequence",         required: false, description: "Stop order number (1, 2, 3…). Auto-assigned if blank." },
        { name: "Duration (min)",   required: false, description: "Expected service duration in minutes" },
        { name: "Service Notes",    required: false, description: "Gate codes, pets, special instructions for this stop" },
        { name: "Expected Services",required: false, description: "e.g. Mow, Edge, Blow" },
        { name: "Cadence",          required: false, description: "weekly | bi-weekly | custom — read from first row of each route" },
        { name: "Days of Week",     required: false, description: "e.g. Monday,Wednesday — read from first row of each route" },
        { name: "Season Start",     required: false, description: "MM-DD format, e.g. 04-01 — read from first row of each route" },
        { name: "Season End",       required: false, description: "MM-DD format, e.g. 11-30 — read from first row of each route" },
      ]}
      notes={[
        "Each row represents one stop. Group stops under the same Route Name to build a full route.",
        "Routes are deduplicated by name (case-insensitive). Existing routes are updated.",
        "Stops are deduplicated by Route Name + property address match. Existing stops are updated.",
        "Cadence, Days of Week, and Season columns are only read from the FIRST row of each route.",
        "If a property address cannot be matched to an existing property, the stop is still created with no property link.",
        "Route metadata (cadence, season window) can be adjusted later in the Route Builder.",
      ]}
      importUrl="/api/maintenance-routes/import"
      backPath="/maintenance-routes"
      backLabel="Maintenance Routes"
      listPath="/maintenance-routes"
      listLabel="View Routes"
    />
  );
}
