import CsvImportPage from "@/components/csv-import/CsvImportPage";

export default function CustomersImport() {
  return (
    <CsvImportPage
      title="Import Customers"
      description="Upload a CSV file to bulk-import or update customer records. Existing customers are matched by email and updated in place; new email addresses create new customers."
      expectedColumns={[
        { name: "FirstName",       required: true,  description: "Customer's first name" },
        { name: "LastName",        required: true,  description: "Customer's last name" },
        { name: "CompanyName",     required: false, description: "Company / business name" },
        { name: "Email",           required: false, description: "Primary email — used for dedup matching" },
        { name: "Phone",           required: false, description: "Primary phone number" },
        { name: "BillingAddress",  required: false, description: "Street address" },
        { name: "BillingCity",     required: false, description: "City" },
        { name: "BillingState",    required: false, description: "State (2-letter code)" },
        { name: "BillingZip",      required: false, description: "ZIP / postal code" },
        { name: "Source",          required: false, description: "How you found this customer (e.g. Referral, Website)" },
        { name: "Notes",           required: false, description: "Internal notes" },
      ]}
      notes={[
        "Rows without FirstName, LastName, or CompanyName are skipped.",
        "If an Email already exists, the customer record is updated (not duplicated).",
        "Phone numbers are stored as primary mobile. Add more in the customer detail page.",
      ]}
      importUrl="/api/customers/import"
      backPath="/customers"
      backLabel="Customers"
      listPath="/customers"
      listLabel="View Customers"
    />
  );
}
