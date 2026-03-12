# Replit Prompt — PDF Field Builder Backend

Paste everything below this line into Replit Agent:

---

Add a backend PDF building endpoint to CompanyHQ that works with the PDF Field Placer tool already installed at /pdf-field-placer.html. When a user finishes placing fields in the tool, they should be able to upload their source PDF, click one button, and download the completed fillable PDF — all without leaving the app.

---

## PART 1 — INSTALL PYTHON DEPENDENCY

Install the pypdf library on the server:

```
pip install pypdf
```

Add it to requirements.txt if that file exists in the project.

---

## PART 2 — BACKEND ROUTE

Create a new API endpoint:

**POST /api/tools/build-pdf**

This endpoint accepts a multipart form upload with two files:
- `source_pdf` — the original PDF file to add fields to
- `field_coords` — a JSON file containing the field definitions

The JSON format for field_coords looks like this:
```json
[
  { "name": "FieldName", "type": "any", "page": 1, "rect": [x0, y0, x1, y1] },
  { "name": "SSN", "type": "ssn", "page": 1, "rect": [x0, y0, x1, y1] },
  { "name": "Date", "type": "date_mdy", "page": 1, "rect": [x0, y0, x1, y1] },
  { "name": "Amount", "type": "currency", "page": 1, "rect": [x0, y0, x1, y1] },
  { "name": "CB1", "type": "checkbox", "page": 1, "rect": [x0, y0, x1, y1] }
]
```

Field type values and what they mean:
- `any` — plain text field, accepts anything
- `name` — plain text field, accepts anything (letters focused)
- `numerical` — numbers only, blocks letters via JavaScript keystroke validation
- `ssn` — numbers only, auto-formats as XXX-XX-XXXX as user types
- `date_mdy` — numbers only, auto-formats as MM/DD/YYYY as user types
- `currency` — uses Acrobat's built-in AFNumber_Format for $0.00 display
- `signature` — plain text field styled for signatures
- `date` — plain text date field no formatting
- `checkbox` — checkbox that draws an X when clicked
- `xmark` — same as checkbox

The endpoint should:
1. Accept the two uploaded files
2. Run the Python PDF building logic (see Part 3)
3. Return the completed PDF as a file download with:
   - Content-Type: application/pdf
   - Content-Disposition: attachment; filename="[original_filename]_fillable.pdf"
4. Clean up any temp files after sending the response

Protect this route — require the user to be logged in (use existing auth middleware). Admin and Manager roles only.

---

## PART 3 — PYTHON PDF BUILDING LOGIC

Create a Python script at `server/pdf_builder.py` with the following complete implementation:

```python
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    DictionaryObject, ArrayObject, NameObject, NumberObject,
    create_string_object, BooleanObject, DecodedStreamObject
)

def make_str(s):
    return create_string_object(s)

def setup_acroform(writer):
    acro = DictionaryObject()
    acro[NameObject("/Fields")] = ArrayObject()
    acro[NameObject("/NeedAppearances")] = BooleanObject(True)
    helv = DictionaryObject()
    helv[NameObject("/Type")]     = NameObject("/Font")
    helv[NameObject("/Subtype")]  = NameObject("/Type1")
    helv[NameObject("/BaseFont")] = NameObject("/Helvetica")
    font_dict = DictionaryObject()
    font_dict[NameObject("/Helv")] = helv
    dr = DictionaryObject()
    dr[NameObject("/Font")] = font_dict
    acro[NameObject("/DR")] = dr
    writer._root_object[NameObject("/AcroForm")] = acro

def make_js_action(writer, js):
    a = DictionaryObject()
    a[NameObject("/Type")] = NameObject("/Action")
    a[NameObject("/S")]    = NameObject("/JavaScript")
    a[NameObject("/JS")]   = make_str(js)
    return writer._add_object(a)

def add_text(writer, page_num, name, tooltip, rect, fmt=None, nums_only=False, font_size=12, align=1):
    page = writer.pages[page_num]
    field = DictionaryObject()
    field[NameObject("/Type")]    = NameObject("/Annot")
    field[NameObject("/Subtype")] = NameObject("/Widget")
    field[NameObject("/FT")]      = NameObject("/Tx")
    field[NameObject("/T")]       = make_str(name)
    field[NameObject("/TU")]      = make_str(tooltip)
    field[NameObject("/Ff")]      = NumberObject(0)
    field[NameObject("/Q")]       = NumberObject(align)
    field[NameObject("/V")]       = make_str("")
    field[NameObject("/DV")]      = make_str("")
    field[NameObject("/Rect")]    = ArrayObject([NumberObject(x) for x in rect])
    bs = DictionaryObject()
    bs[NameObject("/W")] = NumberObject(1)
    bs[NameObject("/S")] = NameObject("/S")
    field[NameObject("/BS")] = bs
    field[NameObject("/DA")] = make_str(f"/Helv {font_size} Tf 0 g")

    aa = DictionaryObject()
    has_aa = False

    if fmt == "ssn":
        ks_js = (
            "if (!event.willCommit) {"
            "  var k = event.change;"
            "  if (!/^[0-9]$/.test(k)) { event.rc = false; return; }"
            "  var raw = event.value.replace(/-/g,'');"
            "  if (raw.length >= 9) { event.rc = false; return; }"
            "  if (raw.length == 2) { event.change = k + '-'; }"
            "  else if (raw.length == 4) { event.change = k + '-'; }"
            "  else { event.change = k; }"
            "}"
        )
        fmt_js = (
            "var v = event.value.replace(/-/g,'');"
            "if (v.length == 9) {"
            "  event.value = v.substr(0,3)+'-'+v.substr(3,2)+'-'+v.substr(5,4);"
            "}"
        )
        aa[NameObject("/K")] = make_js_action(writer, ks_js)
        aa[NameObject("/F")] = make_js_action(writer, fmt_js)
        has_aa = True

    elif fmt == "date":
        ks_js = (
            "if (!event.willCommit) {"
            "  var k = event.change;"
            "  if (!/^[0-9]$/.test(k)) { event.rc = false; return; }"
            "  var raw = event.value.replace(/\\//g,'');"
            "  if (raw.length >= 8) { event.rc = false; return; }"
            "  if (raw.length === 1) { event.change = k + '/'; }"
            "  else if (raw.length === 3) { event.change = k + '/'; }"
            "  else { event.change = k; }"
            "}"
        )
        fmt_js = (
            "var v = event.value.replace(/\\//g,'');"
            "if (v.length == 8) {"
            "  event.value = v.substr(0,2)+'/'+v.substr(2,2)+'/'+v.substr(4,4);"
            "}"
        )
        aa[NameObject("/K")] = make_js_action(writer, ks_js)
        aa[NameObject("/F")] = make_js_action(writer, fmt_js)
        has_aa = True

    elif fmt == "currency":
        aa[NameObject("/K")] = make_js_action(writer, "AFNumber_Keystroke(2, 0, 0, 0, '$', true);")
        aa[NameObject("/F")] = make_js_action(writer, "AFNumber_Format(2, 0, 0, 0, '$', true);")
        has_aa = True

    elif nums_only:
        ks_js = (
            "if (!event.willCommit) {"
            "  if (!/^[0-9]$/.test(event.change)) { event.rc = false; }"
            "}"
        )
        aa[NameObject("/K")] = make_js_action(writer, ks_js)
        has_aa = True

    if has_aa:
        field[NameObject("/AA")] = aa

    ref = writer._add_object(field)
    page[NameObject("/Annots")].append(ref)
    writer._root_object[NameObject("/AcroForm")][NameObject("/Fields")].append(ref)

def add_checkbox(writer, page_num, name, tooltip, rect):
    page = writer.pages[page_num]
    w = rect[2] - rect[0]
    h = rect[3] - rect[1]

    checked_stream = DecodedStreamObject()
    checked_stream._data = (
        f"q 2 w 0 0 m {w:.1f} {h:.1f} l S {w:.1f} 0 m 0 {h:.1f} l S Q"
    ).encode()
    checked_stream[NameObject("/Type")]      = NameObject("/XObject")
    checked_stream[NameObject("/Subtype")]   = NameObject("/Form")
    checked_stream[NameObject("/BBox")]      = ArrayObject([NumberObject(0), NumberObject(0), NumberObject(w), NumberObject(h)])
    checked_stream[NameObject("/Resources")] = DictionaryObject()

    off_stream = DecodedStreamObject()
    off_stream._data = b""
    off_stream[NameObject("/Type")]      = NameObject("/XObject")
    off_stream[NameObject("/Subtype")]   = NameObject("/Form")
    off_stream[NameObject("/BBox")]      = ArrayObject([NumberObject(0), NumberObject(0), NumberObject(w), NumberObject(h)])
    off_stream[NameObject("/Resources")] = DictionaryObject()

    n_dict = DictionaryObject()
    n_dict[NameObject("/Yes")] = writer._add_object(checked_stream)
    n_dict[NameObject("/Off")] = writer._add_object(off_stream)
    ap = DictionaryObject()
    ap[NameObject("/N")] = writer._add_object(n_dict)

    field = DictionaryObject()
    field[NameObject("/Type")]    = NameObject("/Annot")
    field[NameObject("/Subtype")] = NameObject("/Widget")
    field[NameObject("/FT")]      = NameObject("/Btn")
    field[NameObject("/T")]       = make_str(name)
    field[NameObject("/TU")]      = make_str(tooltip)
    field[NameObject("/Ff")]      = NumberObject(0)
    field[NameObject("/V")]       = NameObject("/Off")
    field[NameObject("/AS")]      = NameObject("/Off")
    field[NameObject("/DV")]      = NameObject("/Off")
    field[NameObject("/Rect")]    = ArrayObject([NumberObject(x) for x in rect])
    field[NameObject("/AP")]      = ap
    bs = DictionaryObject()
    bs[NameObject("/W")] = NumberObject(1)
    bs[NameObject("/S")] = NameObject("/S")
    field[NameObject("/BS")] = bs

    ref = writer._add_object(field)
    page[NameObject("/Annots")].append(ref)
    writer._root_object[NameObject("/AcroForm")][NameObject("/Fields")].append(ref)

def build_pdf(source_pdf_path, fields, output_path):
    reader = PdfReader(source_pdf_path)
    writer = PdfWriter()
    writer.clone_reader_document_root(reader)
    setup_acroform(writer)

    # Ensure all pages have /Annots
    for page in writer.pages:
        if NameObject("/Annots") not in page:
            page[NameObject("/Annots")] = ArrayObject()

    for field in fields:
        name     = field.get("name", "Field")
        ftype    = field.get("type", "any")
        page_num = field.get("page", 1) - 1  # convert 1-based to 0-based
        rect     = field.get("rect", [0, 0, 100, 20])

        if ftype in ("checkbox", "xmark"):
            add_checkbox(writer, page_num, name, name, rect)
        elif ftype == "numerical":
            add_text(writer, page_num, name, name, rect, nums_only=True)
        elif ftype == "ssn":
            add_text(writer, page_num, name, "XXX-XX-XXXX", rect, fmt="ssn")
        elif ftype == "date_mdy":
            add_text(writer, page_num, name, "MM/DD/YYYY", rect, fmt="date")
        elif ftype == "currency":
            add_text(writer, page_num, name, name, rect, fmt="currency")
        else:
            # any, name, signature, date (plain) — all plain text
            add_text(writer, page_num, name, name, rect)

    with open(output_path, "wb") as f:
        writer.write(f)

    return output_path
```

---

## PART 4 — WIRE THE ROUTE TO THE SCRIPT

In the route handler for POST /api/tools/build-pdf:

1. Save the uploaded source_pdf to a temp file
2. Parse the field_coords JSON
3. Call `build_pdf(source_pdf_path, fields, output_path)` from pdf_builder.py
4. Stream the output file back as a download
5. Delete both temp files

Use Python's `tempfile` module for temp file handling. Call the Python script from Node using `child_process.spawn` with the path to the Python executable, or if the project already runs Python alongside Node, import and call it directly.

If the project is Node/Express only with no Python runtime, create a small Express route that writes a temporary Python script to disk, executes it with `child_process.spawnSync('python3', [...])`, and returns the result. Pass the source PDF path and fields JSON as arguments.

---

## PART 5 — UPDATE THE PDF FIELD PLACER HTML

Update the file `public/pdf-field-placer.html` to add a Build & Download section.

In the top bar, after the Export JSON button, add:

1. A **Upload Source PDF** button — opens a file picker for .pdf files, stores the selected file in memory (do not upload yet)
2. A label showing the selected filename or "No PDF selected"
3. A **Build Fillable PDF** button (gold/primary style) — disabled until both a PDF is selected and at least one field exists

When Build Fillable PDF is clicked:
1. Show a loading spinner on the button with text "Building..."
2. Create a FormData object with:
   - Append the source PDF file as `source_pdf`
   - Append a Blob of the current fields JSON as `field_coords` with filename `fields.json`
3. POST to `/api/tools/build-pdf`
4. On success: trigger a file download of the returned PDF using a temporary object URL
5. On error: show an alert with the error message
6. Restore the button to normal state after completion

The Build Fillable PDF button should be styled like the primary gold button used elsewhere in the tool. Place it clearly separated from the Export JSON button so users understand these are two different actions — Export JSON saves coordinates for later, Build Fillable PDF creates the actual finished form.

---

## PART 6 — NOTES

- Admin and Manager roles only for this endpoint
- Max file size for uploaded PDFs: 25MB (consistent with the rest of the document system)
- If pypdf is not available in the runtime, show a clear error message to the user rather than a generic 500
- Do not store the source PDF or output PDF permanently — temp files only, cleaned up immediately after the download is sent
- Do not modify any other existing routes or files
