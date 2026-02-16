# GotovDoc — Document Style Guide

Reference for all formatting, styling, and processing conventions applied to DOCX templates.
Follow these rules when creating or modifying any document template.

---

## 1. Footer

Every template must include a standardised footer.

### Content

```
GOTOVDOC.BG  —  създаване на документи за секунди
```

### Styling

| Property          | Brand name (`GOTOVDOC.BG`) | Subtitle (създаване на документи за секунди) |
| ----------------- | -------------------------- | -------------------------------------------- |
| Font              | Helvetica Neue             | Helvetica Neue                               |
| Size              | 12 pt (24 half-points)     | 12 pt (24 half-points)                       |
| Weight            | **Bold**                   | Normal                                       |
| Color             | `#555555`                  | `#888888`                                    |
| Letter spacing    | 30 twips (~1.5 pt)         | 30 twips (~1.5 pt)                           |
| Casing            | UPPERCASE                  | Lowercase (natural)                          |

### Paragraph

- **Alignment**: Center
- **Top border**: Single line, 4-unit width, 4-unit spacing, color `#CCCCCC`

### Footer XML (copy into new templates)

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="4" w:color="CCCCCC"/>
      </w:pBdr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:cs="Helvetica Neue"/>
        <w:spacing w:val="30"/>
        <w:b/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:color w:val="555555"/>
      </w:rPr>
      <w:t>GOTOVDOC.BG</w:t>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:cs="Helvetica Neue"/>
        <w:spacing w:val="30"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:color w:val="888888"/>
      </w:rPr>
      <w:t xml:space="preserve">  —  създаване на документи за секунди</w:t>
    </w:r>
  </w:p>
</w:ftr>
```

### Wiring the footer into the DOCX

1. Save the XML above as `word/footerN.xml` inside the DOCX ZIP (pick the next available N).
2. Add a relationship in `word/_rels/document.xml.rels`:
   ```xml
   <Relationship Id="rIdFOOTER" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footerN.xml"/>
   ```
3. Reference it in the `<w:sectPr>` of `word/document.xml`:
   ```xml
   <w:footerReference w:type="default" r:id="rIdFOOTER"/>
   ```
4. Add a content type entry in `[Content_Types].xml`:
   ```xml
   <Override PartName="/word/footerN.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
   ```

---

## 2. Dynamic Placeholder Fields

All dynamic placeholders (e.g. `{company_name}`, `{egn}`) must render in **bold**.

### How to apply in the template XML

Each placeholder's `<w:r>` (run) must include `<w:b/>` in its `<w:rPr>`:

```xml
<w:r>
  <w:rPr>
    <w:b/>
  </w:rPr>
  <w:t>{placeholder_name}</w:t>
</w:r>
```

If a placeholder is split across multiple XML runs (common after editing in Word), the runs must be merged or each fragment must carry `<w:b/>`.

---

## 3. Date Formatting

All date fields must be displayed in **Bulgarian format**: `dd.mm.yyyy г.`

### Configuration

Each template config in `document-templates.config.ts` has a `dateFields` array listing which fields are dates. The `toBulgarianDate()` utility converts:

- ISO dates (`2026-02-20`, `2026-02-20T00:00:00Z`) → `20.02.2026 г.`
- Already-formatted (`20.02.2026`) → `20.02.2026 г.`

### When adding a new template

Add all date field names to the `dateFields` array in the template config.

---

## 4. HTML Entity Decoding

User-provided text may contain HTML entities from the frontend. These must be decoded **before** passing data to Docxtemplater.

### Entities handled

| Entity    | Character |
| --------- | --------- |
| `&quot;`  | `"`       |
| `&#39;`   | `'`       |
| `&lt;`    | `<`       |
| `&gt;`    | `>`       |
| `&amp;`   | `&`       |

This is done automatically by `DocumentController.sanitizeData()` inside `renderTemplate()`. Ensure any new controller that renders DOCX templates also applies this sanitization.

---

## 5. Text Alignment

For header blocks that contain dynamic names (e.g. company names, personal names):

- **Do NOT** use fixed left indents (`<w:ind w:left="..."/>`) — they cause awkward wrapping on long names.
- **Use right justification** (`<w:jc w:val="right"/>`) instead, which lets text use the full page width while staying right-aligned.

---

## 6. Auto-derived Fields

Some fields are auto-derived from user input rather than supplied directly:

| Template       | Field          | Logic                                                                  |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| Leave request  | `legal_basis`  | `платен` → `чл. 155, ал. 1` / `неплатен` → `чл. 160, ал. 1`          |

These are set in the `validate` function of the template config.

---

## Checklist for New Templates

- [ ] Add footer XML (section 1)
- [ ] Wire footer in `document.xml.rels`, `document.xml`, `[Content_Types].xml`
- [ ] Bold all `{placeholder}` runs (section 2)
- [ ] List date fields in config `dateFields` (section 3)
- [ ] Verify HTML entity decoding applies (section 4)
- [ ] Use right-justification instead of fixed indents for dynamic header text (section 5)
- [ ] Add any auto-derived fields in `validate` (section 6)
