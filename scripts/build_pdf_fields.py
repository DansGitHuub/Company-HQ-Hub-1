import sys
import json
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    DictionaryObject, ArrayObject, NameObject, NumberObject,
    create_string_object, BooleanObject, DecodedStreamObject
)

def make_str(s): return create_string_object(s)

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
        ks_js  = "AFNumber_Keystroke(2, 0, 0, 0, '$', true);"
        fmt_js = "AFNumber_Format(2, 0, 0, 0, '$', true);"
        aa[NameObject("/K")] = make_js_action(writer, ks_js)
        aa[NameObject("/F")] = make_js_action(writer, fmt_js)
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

def add_signature(writer, page_num, name, tooltip, rect):
    """Create a PDF signature widget field (/FT /Sig).
    In Acrobat/Reader this opens the Sign dialog. Browser PDF viewers
    render it as a labelled signature placeholder box (not a type-in field).
    """
    page = writer.pages[page_num]
    field = DictionaryObject()
    field[NameObject("/Type")]    = NameObject("/Annot")
    field[NameObject("/Subtype")] = NameObject("/Widget")
    field[NameObject("/FT")]      = NameObject("/Sig")
    field[NameObject("/T")]       = make_str(name)
    field[NameObject("/TU")]      = make_str(tooltip)
    field[NameObject("/Ff")]      = NumberObject(0)
    field[NameObject("/Rect")]    = ArrayObject([NumberObject(x) for x in rect])
    bs = DictionaryObject()
    bs[NameObject("/W")] = NumberObject(1)
    bs[NameObject("/S")] = NameObject("/S")
    field[NameObject("/BS")] = bs
    ref = writer._add_object(field)
    page[NameObject("/Annots")].append(ref)
    writer._root_object[NameObject("/AcroForm")][NameObject("/Fields")].append(ref)

def add_checkbox(writer, page_num, name, tooltip, rect):
    page = writer.pages[page_num]
    w = rect[2] - rect[0]
    h = rect[3] - rect[1]
    checked_stream = DecodedStreamObject()
    checked_stream._data = (f"q 2 w 0 0 m {w:.1f} {h:.1f} l S {w:.1f} 0 m 0 {h:.1f} l S Q").encode()
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

input_path  = sys.argv[1]
output_path = sys.argv[2]
fields_json = sys.argv[3]

fields = json.loads(fields_json)

reader = PdfReader(input_path)
writer = PdfWriter()
writer.clone_reader_document_root(reader)
setup_acroform(writer)

for page_num in range(len(writer.pages)):
    page = writer.pages[page_num]
    from pypdf.generic import NameObject as NO, ArrayObject as AO
    if NO("/Annots") not in page:
        page[NO("/Annots")] = AO()

for f in fields:
    page   = f["page"]
    name   = f["name"]
    rect   = f["rect"]
    ftype  = f["type"]

    if ftype in ("xmark", "checkbox"):
        add_checkbox(writer, page, name, name, rect)
    elif ftype == "signature":
        add_signature(writer, page, name, name, rect)
    elif ftype == "numerical":
        add_text(writer, page, name, name, rect, nums_only=True)
    elif ftype == "currency":
        add_text(writer, page, name, name, rect, fmt="currency")
    elif ftype == "date_mdy":
        add_text(writer, page, name, "MM/DD/YYYY", rect, fmt="date")
    elif ftype == "ssn":
        add_text(writer, page, name, "XXX-XX-XXXX", rect, fmt="ssn")
    else:
        add_text(writer, page, name, name, rect)

with open(output_path, "wb") as out:
    writer.write(out)

print("OK")
