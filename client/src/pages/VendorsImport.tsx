import CsvImportPage from "@/components/csv-import/CsvImportPage";

const EXPECTED_COLUMNS = ["Name", "ContactName", "Email", "Phone", "Address", "Category", "Notes"];

export default function VendorsImport() {
  return (
    <CsvImportPage
      title="Import Vendors"
      description="Upload a CSV file to bulk-import vendors/suppliers"
      expectedColumns={EXPECTED_COLUMNS}
      notes={[
        "Name is required for every row.",
        "Name is used to detect duplicates (case-insensitive) — a match updates the existing vendor instead of creating a new one.",
      ]}
      importUrl="/api/vendors/import"
      backPath="/vendors"
      backLabel="Back to Vendors"
      listPath="/vendors"
      listLabel="View Vendors"
    />
  );
}
