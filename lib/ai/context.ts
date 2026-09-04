// Page-aware context + session memory shapes (client supplies both per turn).
export interface PageCtx {
  path: string;
  companyId?: number;
  market?: string; // country name
  opportunityId?: number;
  enquiryId?: number;
  quoteId?: number;
}

export function parsePage(pathname: string, search: string): PageCtx {
  const q = new URLSearchParams(search || "");
  const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const mBuyer = pathname.match(/^\/buyers\/(\d+)/);
  if (mBuyer) return { path: pathname, companyId: Number(mBuyer[1]) };
  const mOpp = pathname.match(/^\/opportunities\/(\d+)/);
  if (mOpp) return { path: pathname, opportunityId: Number(mOpp[1]) };
  const mEnq = pathname.match(/^\/enquiries\/(\d+)/);
  if (mEnq) return { path: pathname, enquiryId: Number(mEnq[1]) };
  const mQ = pathname.match(/^\/quotes\/(\d+)/);
  if (mQ) return { path: pathname, quoteId: Number(mQ[1]) };
  const mC = pathname.match(/^\/countries\/([A-Z]{2})/);
  if (mC) return { path: pathname, market: q.get("name") ?? undefined };
  return {
    path: pathname,
    companyId: num(q.get("company")) ?? num(q.get("companyId")),
    market: q.get("market") ?? undefined,
  };
}

export interface ChatMsg { role: "user" | "assistant"; content: string }

export interface LastState {
  ids?: number[]; // buyer IDs from the last listed result (for "these", "all three")
  filters?: { country?: string; region?: string; company_type?: string; grade?: "A" | "B" | "C"; stage?: string; text?: string };
}
