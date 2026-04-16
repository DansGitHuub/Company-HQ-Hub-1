
Fix this bug in client/src/pages/catalog/CatalogDetail.tsx:
Error: A <Select.Item /> must have a value prop that is not an empty string.

Find every <SelectItem value=""> or <SelectItem value={""}> in the file and replace the empty string with a non-empty placeholder like "all" or "none" (e.g., <SelectItem value="all">All</SelectItem>).

Then republish to companyhq.app.