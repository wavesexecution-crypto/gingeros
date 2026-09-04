// Central configuration — Admin / Settings extensible (Req 17)
// Client-visible business config. Waves-internal infra config lives in env.
export const REGIONS = ["UAE", "Middle East", "Europe", "South Africa"] as const;
export type Region = (typeof REGIONS)[number];

export const COUNTRIES: { code: string; name: string; region: Region }[] = [
  { code: "AE", name: "UAE", region: "UAE" },
  { code: "SA", name: "Saudi Arabia", region: "Middle East" },
  { code: "QA", name: "Qatar", region: "Middle East" },
  { code: "OM", name: "Oman", region: "Middle East" },
  { code: "KW", name: "Kuwait", region: "Middle East" },
  { code: "BH", name: "Bahrain", region: "Middle East" },
  { code: "JO", name: "Jordan", region: "Middle East" },
  { code: "GB", name: "United Kingdom", region: "Europe" },
  { code: "DE", name: "Germany", region: "Europe" },
  { code: "FR", name: "France", region: "Europe" },
  { code: "NL", name: "Netherlands", region: "Europe" },
  { code: "IT", name: "Italy", region: "Europe" },
  { code: "ES", name: "Spain", region: "Europe" },
  { code: "BE", name: "Belgium", region: "Europe" },
  { code: "ZA", name: "South Africa", region: "South Africa" },
];

export const BUYER_TYPES = [
  "Importer",
  "Distributor",
  "Wholesaler",
  "Spice company",
  "Food ingredient company",
  "Food manufacturer",
  "Beverage manufacturer",
  "Hotel supplier",
  "Restaurant supplier",
  "Trading company",
  "Other",
] as const;

export const PIPELINE_STAGES = [
  "Discovered",
  "Qualified",
  "Researching",
  "Contacted",
  "Responded",
  "Interested",
  "Enquiry",
  "Quotation Sent",
  "Negotiation",
  "Won",
  "Lost",
  "Not Relevant",
] as const;

export const OUTREACH_STATUS = [
  "Not contacted",
  "Contacted",
  "Follow-up 1",
  "Follow-up 2",
  "Responded",
  "Interested",
  "Not interested",
  "No response",
] as const;

export const ENQUIRY_STATUS = ["New", "Qualified", "Quotation Required", "Quotation Sent", "Negotiation", "Won", "Lost"] as const;
export const QUOTE_STATUS = ["Draft", "Sent", "Viewed", "Negotiation", "Accepted", "Rejected", "Expired"] as const;
export const DATA_LABELS = ["DEMO", "VERIFIED", "UNVERIFIED", "IMPORTED", "MANUAL"] as const;
export const CURRENCIES = ["USD", "AED", "EUR", "GBP", "ZAR", "INR", "SAR", "QAR"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CIP", "DAP", "DPU", "DDP"] as const;

export const PRODUCTS = [{ id: "dry-ginger", name: "Dry Ginger", hs: "0910.12", desc: "Whole / slices / powder" }];

export const PRODUCT_DRY_GINGER = {
  id: "dry-ginger",
  name: "Dry Ginger",
  hsCodes: ["0910.12"],
  forms: ["Whole", "Slices", "Powder", "Bleached / Unbleached"],
};

export function regionForCountry(country: string): Region | "Other" {
  const c = COUNTRIES.find((x) => x.name.toLowerCase() === country.toLowerCase() || x.code === country);
  return c ? c.region : "Other";
}
