import CsvImportPage from "@/components/csv-import/CsvImportPage";

export default function PlowSitesImport() {
  return (
    <CsvImportPage
      title="Import Plow Sites"
      description="Upload a CSV file to bulk-import or update plow site records. Existing sites are matched by name (case-insensitive) and updated. New group names are created automatically."
      expectedColumns={[
        { name: "Name",      required: true,  description: "Site name — used for dedup matching" },
        { name: "Address",   required: false, description: "Street address of the site" },
        { name: "Latitude",  required: false, description: "GPS latitude (decimal)" },
        { name: "Longitude", required: false, description: "GPS longitude (decimal)" },
        { name: "Group",     required: false, description: "Route group name — created automatically if it doesn't exist" },
      ]}
      notes={[
        "Sites are deduplicated by Name (case-insensitive match).",
        "Existing sites are updated; new sites are created.",
        "If a Group name doesn't exist it will be created with a default grey color.",
        "Leave Latitude/Longitude blank if you don't have GPS coordinates — you can pin the site on the map later.",
      ]}
      importUrl="/api/plow-sites/import"
      backPath="/tools"
      backLabel="Tools"
      listPath="/tools"
      listLabel="Back to Tools"
    />
  );
}
