// Provider abstractions — Waves-managed, client sees business system only (Req 7, 21)
// Future: trade DBs, company DBs, search APIs, LinkedIn-compatible (where legal),
// email enrichment, domain intelligence, AI, email sending.

export interface DiscoveryFilters {
  product: string;
  region?: string;
  country?: string;
  buyerType?: string;
  minGrade?: "A" | "B" | "C";
}

export interface DiscoveredCompany {
  name: string;
  country: string;
  city?: string;
  website?: string;
  companyType?: string;
  industry?: string;
  products?: string;
  source: string;
  sourceUrl?: string;
  evidence?: string;
}

export interface DiscoveryProvider {
  id: string;
  label: string;
  status: "connected" | "not-connected";
  discover(f: DiscoveryFilters): Promise<DiscoveredCompany[]>;
}

export interface EnrichmentProvider {
  id: string;
  label: string;
  status: "connected" | "not-connected";
  enrich(domain: string): Promise<Record<string, string>>;
}

export interface EmailProvider {
  id: string;
  label: string;
  status: "connected" | "not-connected";
  send(to: string, subject: string, body: string): Promise<{ queued: boolean; note: string }>;
}

export interface AIBriefInput {
  company: { name: string; country: string; city?: string; industry?: string; products?: string; website?: string };
  signals: string[];
  evidence?: string;
  grade?: string;
  score?: number;
}

// AI abstraction — never invents facts. Only references provided evidence.
export interface AIProvider {
  id: string;
  label: string;
  status: "connected" | "not-connected";
  whyContact(input: AIBriefInput): Promise<string>;
  outreachDraft(input: AIBriefInput & { contactName?: string }): Promise<string>;
  followupDraft(input: AIBriefInput & { lastTouch?: string }): Promise<string>;
  nextActions(input: AIBriefInput & { stage?: string }): Promise<string[]>;
  companySummary(input: AIBriefInput): Promise<string>;
}

class MockDiscovery implements DiscoveryProvider {
  id = "mock-local"; label = "Local database (no live source)"; status: "connected" = "connected";
  async discover(_f: DiscoveryFilters): Promise<DiscoveredCompany[]> { return []; }
}

class MockEmail implements EmailProvider {
  id = "mock-email"; label = "Email (not connected)"; status: "not-connected" = "not-connected";
  async send() { return { queued: false, note: "No email integration connected. Draft saved to activity timeline. Connect provider in Admin." }; }
}

class MockEnrichment implements EnrichmentProvider {
  id = "mock-enrich"; label = "Enrichment (not connected)"; status: "not-connected" = "not-connected";
  async enrich() { return {}; }
}

// Evidence-grounded mock AI — safe default until Waves connects a real provider.
class LocalEvidenceAI implements AIProvider {
  id = "local-evidence"; label = "Local evidence-grounded assistant"; status: "connected" = "connected";
  private guard(ev?: string) { return ev && ev.trim().length > 0 ? ev : "Evidence not available"; }
  async whyContact(i: AIBriefInput) {
    const sigs = i.signals.length ? i.signals.map((s) => `- ${s}`).join("\n") : "- Evidence not available";
    return `Why contact ${i.company.name} (${i.company.country})?\n\nGrade ${i.grade ?? "Unknown"} (${i.score ?? "? "}/100).\nBuying relevance:\n${sigs}\n\nEvidence: ${this.guard(i.evidence)}\n\nSuggested angle: dry ginger (whole/slices/powder) for spice/ingredient use. Confirm import need, volumes, specs, destination port before quoting. If no verified signals, treat as research-first, not sales-ready.`;
  }
  async outreachDraft(i: AIBriefInput & { contactName?: string }) {
    return `Subject: Dry ginger from India — specs & pricing for ${i.company.name}\n\nDear ${i.contactName ?? "Procurement team"},\n\nI'm writing from India regarding dry ginger (whole / slices / powder, HS 0910.12).\n\nRelevance to you: ${(i.company.products ?? "Unknown")}. Evidence: ${this.guard(i.evidence)}\n\nCould you share: (1) required form & specs, (2) monthly quantity, (3) destination port, (4) packaging? I'll revert with specs, validity, Incoterm and lead time.\n\nBest regards`;
  }
  async followupDraft(i: AIBriefInput & { lastTouch?: string }) {
    return `Follow-up — dry ginger enquiry (${i.company.name})\n\nJust following up on my note ${i.lastTouch ?? "last week"}. Evidence on file: ${this.guard(i.evidence)}\n\nIf helpful I can share specs + indicative CIF pricing once you confirm quantity and destination port. Should I keep this open or close for now?`;
  }
  async nextActions(i: AIBriefInput & { stage?: string }) {
    const stage = i.stage ?? "Discovered";
    if (stage === "Discovered") return ["Verify website + product range", "Find procurement / import contact", "Log evidence, then qualify"];
    if (stage === "Contacted") return ["Follow up in 3–4 days", "Send specs one-pager", "Ask quantity + destination port"];
    if (stage === "Interested" || stage === "Enquiry") return ["Capture enquiry specs formally", "Send quotation with validity + Incoterm", "Set negotiation follow-up"];
    return ["Review timeline", "Set next action with date + owner", "Re-qualify if no response in 14 days"];
  }
  async companySummary(i: AIBriefInput) {
    return `${i.company.name} — ${i.company.city ?? "Unknown city"}, ${i.company.country}. Industry: ${i.company.industry ?? "Unknown"}. Products: ${i.company.products ?? "Unknown"}. Website: ${i.company.website ?? "Unknown"}. Signals: ${i.signals.length ? i.signals.join("; ") : "Evidence not available"}. Evidence: ${this.guard(i.evidence)}`;
  }
}

export const discoveryProviders: DiscoveryProvider[] = [new MockDiscovery()];
export const emailProvider: EmailProvider = new MockEmail();
export const enrichmentProviders: EnrichmentProvider[] = [new MockEnrichment()];
export const aiProvider: AIProvider = new LocalEvidenceAI();

// Waves-internal registry (not shown to client as infra): provider health, usage.
export function providerHealth() {
  return {
    ai: { id: aiProvider.id, status: aiProvider.status },
    discovery: discoveryProviders.map((p) => ({ id: p.id, status: p.status })),
    email: { id: emailProvider.id, status: emailProvider.status },
    note: "Live trade/company data requires a connected provider. Until then the app uses local DEMO/entered data only and never fabricates.",
  };
}
