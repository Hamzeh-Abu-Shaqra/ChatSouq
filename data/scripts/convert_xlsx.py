#!/usr/bin/env python3
"""Convert the ChatSouq source .xlsx exports into clean NDJSON seed files.

The source spreadsheets are scraped third-party data and are treated as
*seed/sample data only* — they live outside the app code and are easy to swap.

Reads from CHATSOUQ_SRC_DIR (default: ~/Desktop) and writes NDJSON to
<repo>/data/seed/. No third-party Python deps (parses xlsx XML directly).
"""
import io
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SRC = os.environ.get("CHATSOUQ_SRC_DIR", os.path.expanduser("~/Desktop"))
OUT = os.path.join(os.path.dirname(__file__), "..", "seed")
OUT = os.path.abspath(OUT)


def shared_strings(z):
    out = []
    if "xl/sharedStrings.xml" not in z.namelist():
        return out
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def cell_value(c, shared):
    t = c.get("t")
    v = c.find(f"{NS}v")
    if v is not None:
        val = v.text or ""
        if t == "s":
            return shared[int(val)]
        return val
    isn = c.find(f"{NS}is")
    if isn is not None:
        return "".join(x.text or "" for x in isn.iter(f"{NS}t"))
    return ""


def col_of(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def iter_rows(z, sheet_path, shared):
    """Stream rows of a worksheet as {column_letter: value} dicts."""
    ctx = ET.iterparse(io.BytesIO(z.read(sheet_path)), events=("end",))
    for ev, el in ctx:
        if el.tag == f"{NS}row":
            row = {}
            for c in el.findall(f"{NS}c"):
                row[col_of(c.get("r"))] = cell_value(c, shared)
            yield row
            el.clear()


def sheet_path_for(z, name):
    """Resolve a sheet name to its worksheet xml path via workbook rels."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {}
    for r in rels:
        rid_to_target[r.get("Id")] = r.get("Target")
    for s in wb.iter(f"{NS}sheet"):
        if s.get("name") == name:
            rid = s.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )
            target = rid_to_target[rid].lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            return target
    raise KeyError(f"sheet {name!r} not found")


def clean(v):
    v = (v or "").strip()
    return v if v else None


def to_number(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def header_index(first_row):
    """Map normalized header name -> column letter."""
    return {(first_row[c] or "").strip(): c for c in first_row}


def convert_vendors(z_path):
    z = zipfile.ZipFile(z_path)
    shared = shared_strings(z)
    sp = sheet_path_for(z, "vendors")
    rows = iter_rows(z, sp, shared)
    header = header_index(next(rows))
    out = []

    def g(row, key):
        col = header.get(key)
        return clean(row.get(col)) if col else None

    for row in rows:
        vid = g(row, "id")
        if not vid:
            continue
        out.append(
            {
                "id": int(float(vid)),
                "userId": int(float(g(row, "user_id"))) if g(row, "user_id") else None,
                "businessName": g(row, "business_name"),
                "category": g(row, "category"),
                "description": g(row, "description"),
                "location": g(row, "location"),
                "websiteUrl": g(row, "website_url"),
                "instagramUrl": g(row, "instagram_url"),
                "status": g(row, "status") or "approved",
            }
        )
    return out


def convert_listings(z_path, out_file):
    z = zipfile.ZipFile(z_path)
    shared = shared_strings(z)
    sp = sheet_path_for(z, "listings")
    rows = iter_rows(z, sp, shared)
    header = header_index(next(rows))

    def g(row, key):
        col = header.get(key)
        return clean(row.get(col)) if col else None

    n = 0
    skipped = 0
    with open(out_file, "w", encoding="utf-8") as f:
        for row in rows:
            lid = g(row, "id")
            vid = g(row, "vendor_id")
            name = g(row, "name")
            if not lid or not vid or not name:
                skipped += 1
                continue
            rec = {
                "id": int(float(lid)),
                "vendorId": int(float(vid)),
                "name": name,
                "description": g(row, "description"),
                "category": g(row, "category"),
                "price": to_number(g(row, "price")),
                "currency": g(row, "currency") or "JOD",
                "imageUrl": g(row, "image_url"),
                "brand": g(row, "brand"),
                "sourceUrl": g(row, "source_url"),
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
    return n, skipped


def write_ndjson(path, records):
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    vendors_src = os.path.join(SRC, "ChatSouq RETAIL.xlsx")
    listings_src = os.path.join(SRC, "ChatSouq RETAIL LISTINGS.xlsx")

    missing = [p for p in (vendors_src, listings_src) if not os.path.exists(p)]
    if missing:
        print("ERROR: source files not found:", *missing, sep="\n  ", file=sys.stderr)
        print(f"\nSet CHATSOUQ_SRC_DIR to the folder containing them (current: {SRC}).", file=sys.stderr)
        sys.exit(1)

    print(f"Source dir: {SRC}")
    print(f"Output dir: {OUT}\n")

    vendors = convert_vendors(vendors_src)
    write_ndjson(os.path.join(OUT, "vendors.ndjson"), vendors)
    print(f"vendors.ndjson:  {len(vendors)} rows")

    n, skipped = convert_listings(listings_src, os.path.join(OUT, "listings.ndjson"))
    print(f"listings.ndjson: {n} rows ({skipped} skipped for missing id/vendor/name)")


if __name__ == "__main__":
    main()
