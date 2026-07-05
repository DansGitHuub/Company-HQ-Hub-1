import CsvImportPage from "@/components/csv-import/CsvImportPage";

const EXPECTED_COLUMNS = ["Name", "Type", "Nickname", "Category", "Year", "Make", "Model", "VIN", "SerialNumber", "LicensePlate", "Status", "Location", "Notes"];

export default function EquipmentImport() {
  return (
    <CsvImportPage
      title="Import Equipment"
      description="Upload a CSV file to bulk-import fleet/equipment assets"
      expectedColumns={EXPECTED_COLUMNS}
      notes={[
        "Name is required for every row.",
        "VIN or SerialNumber is used to detect duplicates — a match updates the existing asset instead of creating a new one.",
        "Status defaults to \"Active\" if left blank. A new Asset ID is auto-generated for new assets.",
      ]}
      importUrl="/api/fleet/assets/import"
      backPath="/equipment"
      backLabel="Back to Equipment"
      listPath="/equipment"
      listLabel="View Equipment"
    />
  );
}
