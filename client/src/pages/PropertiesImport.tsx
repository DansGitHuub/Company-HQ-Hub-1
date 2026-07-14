import CsvImportPage from "@/components/csv-import/CsvImportPage";

export default function PropertiesImport() {
  return (
    <CsvImportPage
      title="Import Properties"
      description="Upload a CSV file to bulk-import or update property records. Each row must include the customer's email so the system can link it to the right customer. Existing properties are matched by customer + address and updated in place."
      expectedColumns={[
        { name: "CustomerEmail", required: true,  description: "Email of the existing customer to attach the property to" },
        { name: "Address",       required: true,  description: "Street address of the property" },
        { name: "City",          required: false, description: "City" },
        { name: "State",         required: false, description: "State (2-letter code)" },
        { name: "Zip",           required: false, description: "ZIP / postal code" },
        { name: "PropertyType",  required: false, description: "e.g. Residential, Commercial" },
        { name: "Notes",         required: false, description: "General property notes" },
        { name: "AccessNotes",   required: false, description: "How to access the property" },
        { name: "GateCode",      required: false, description: "Gate or entry code" },
        { name: "HasPets",       required: false, description: "true or false" },
      ]}
      notes={[
        "CustomerEmail must match an existing customer in the system.",
        "Rows where no matching customer is found are skipped and reported as errors.",
        "Properties are deduped by CustomerEmail + Address. Existing entries are updated.",
      ]}
      importUrl="/api/properties/import"
      backPath="/customers"
      backLabel="Customers"
      listPath="/customers"
      listLabel="View Customers"
    />
  );
}
