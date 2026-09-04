// Buyer Qualification Engine (Req 4)
// Explainable, no fake certainty. All inputs must be evidence-backed or Unknown.
export type Grade = "A" | "B" | "C";

export interface QualificationInput {
  productRelevance: 0 | 1 | 2 | 3; // 0 none, 3 spices/dry ginger adjacent
  importerStatus: 0 | 1 | 2; // 0 unknown, 1 likely, 2 confirmed importer/distributor
  internationalSourcing: 0 | 1 | 2; // 0 unknown, 1 some, 2 works with Indian suppliers
  gingerFit: 0 | 1 | 2 | 3; // dry ginger relevance
  geoPriority: 0 | 1 | 2; // 0 low, 2 UAE/EU/ZAF priority market
  companyQuality: 0 | 1 | 2; // website, size, history
  contactAvailability: 0 | 1 | 2; // 0 none, 2 procurement contact w/ verified channel
  evidenceStrength: 0 | 1 | 2; // 0 none, 2 strong source+url
  buyingSignals: number; // 0..n count of real signals
}

export interface ScoreBreakdown {
  label: string;
  points: number;
  max: number;
  reason: string;
}

export function scoreBuyer(i: QualificationInput): { score: number; grade: Grade; breakdown: ScoreBreakdown[] } {
  const b: ScoreBreakdown[] = [
    { label: "Product relevance", max: 25, points: [0, 8, 17, 25][i.productRelevance] ?? 0, reason: ["No evidence of relevant products", "Adjacent food category", "Spices / ingredients", "Spices incl. ginger/dried ingredients"][i.productRelevance] ?? "Unknown" },
    { label: "Importer status", max: 15, points: [0, 8, 15][i.importerStatus] ?? 0, reason: ["Unknown", "Likely importer/trader", "Confirmed importer/distributor"][i.importerStatus] ?? "Unknown" },
    { label: "International sourcing", max: 10, points: [0, 5, 10][i.internationalSourcing] ?? 0, reason: ["Unknown", "Some import activity", "Sources internationally / India"][i.internationalSourcing] ?? "Unknown" },
    { label: "Dry ginger fit", max: 20, points: [0, 7, 14, 20][i.gingerFit] ?? 0, reason: ["Unknown / none", "Low — general food", "Medium — spices/dried foods", "High — ginger/spice ingredients"][i.gingerFit] ?? "Unknown" },
    { label: "Geographic priority", max: 10, points: [0, 5, 10][i.geoPriority] ?? 0, reason: ["Outside focus", "Adjacent market", "Priority: UAE/ME/EU/ZAF"][i.geoPriority] ?? "Unknown" },
    { label: "Company quality", max: 5, points: [0, 3, 5][i.companyQuality] ?? 0, reason: ["Unknown", "Basic presence", "Established presence"][i.companyQuality] ?? "Unknown" },
    { label: "Contact availability", max: 5, points: [0, 3, 5][i.contactAvailability] ?? 0, reason: ["No contact", "Generic contact", "Decision-maker / procurement"][i.contactAvailability] ?? "Unknown" },
    { label: "Evidence strength", max: 5, points: [0, 3, 5][i.evidenceStrength] ?? 0, reason: ["Unverified", "Single source", "Source + URL, recently verified"][i.evidenceStrength] ?? "Unknown" },
    { label: "Buying signals", max: 5, points: Math.min(5, i.buyingSignals), reason: i.buyingSignals === 0 ? "No verified signals — Evidence not available" : `${i.buyingSignals} verified signal(s)` },
  ];
  const score = b.reduce((s, x) => s + x.points, 0);
  const grade: Grade = score >= 75 ? "A" : score >= 50 ? "B" : "C";
  return { score, grade, breakdown: b };
}

export function gradeLabel(g: Grade) {
  return g === "A" ? "HIGH PRIORITY" : g === "B" ? "MEDIUM PRIORITY" : "LOW PRIORITY";
}
