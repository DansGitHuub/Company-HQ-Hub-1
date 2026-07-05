import CsvImportPage from "@/components/csv-import/CsvImportPage";

const EXPECTED_COLUMNS = ["FirstName", "LastName", "Email", "Phone", "JobTitle", "Department", "EmploymentType", "StartDate", "WorkLocation", "Status"];

export default function EmployeesImport() {
  return (
    <CsvImportPage
      title="Import Employees"
      description="Upload a CSV file to bulk-import employee records"
      expectedColumns={EXPECTED_COLUMNS}
      notes={[
        "FirstName and LastName are required for every row.",
        "Email is used to detect duplicates — a matching email updates the existing employee instead of creating a new one.",
        "Status defaults to \"Active\" if left blank.",
      ]}
      importUrl="/api/employees/import"
      backPath="/employees"
      backLabel="Back to Employees"
      listPath="/employees"
      listLabel="View Employees"
    />
  );
}
