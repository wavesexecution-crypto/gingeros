// CSV import — validate, dedupe, label provenance (Req 23)
import { z } from "zod";

export const ImportRow = z.object({
  Company: z.string().min(1),
  Country: z.string().min(1),
  City: z.string().optional().default(""),
  Website: z.string().optional().default("Unknown"),
  CompanyType: z.string().optional().default("Other"),
  ContactName: z.string().optional().default(""),
  Role: z.string().optional().default(""),
  Email: z.string().optional().default("Unknown"),
  Phone: z.string().optional().default("Unknown"),
  LinkedIn: z.string().optional().default(""),
  Source: z.string().optional().default("IMPORTED"),
  Evidence: z.string().optional().default(""),
});
export type ImportRowT = z.infer<typeof ImportRow>;

export function parseCSV(text: string): { rows: ImportRowT[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { rows: [], errors: ["Empty file"] };
  const head = splitLine(lines[0]).map((h) => h.trim());
  const rows: ImportRowT[] = []; const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const obj: Record<string, string> = {};
    head.forEach((h, j) => (obj[h] = (cells[j] ?? "").trim()));
    // normalize lowercase keys
    const norm: Record<string, string> = {};
    for (const k of Object.keys(obj)) norm[cap(k)] = obj[k];
    const r = ImportRow.safeParse({
      Company: norm["Company"] ?? "", Country: norm["Country"] ?? "", City: norm["City"] ?? "",
      Website: norm["Website"] ?? "Unknown", CompanyType: norm["CompanyType"] ?? norm["Company type"] ?? "Other",
      ContactName: norm["Contactname"] ?? norm["Contact name"] ?? "", Role: norm["Role"] ?? "",
      Email: norm["Email"] ?? "Unknown", Phone: norm["Phone"] ?? "Unknown",
      LinkedIn: norm["Linkedin"] ?? "", Source: norm["Source"] ?? "IMPORTED", Evidence: norm["Evidence"] ?? "",
    });
    if (!r.success) errors.push(`Row ${i + 1}: ${r.error.issues.map((x) => x.message).join(", ")}`);
    else rows.push(r.data);
  }
  return { rows, errors };
}
function cap(k: string) { return k.replace(/\s+/g, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()); }
function splitLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
