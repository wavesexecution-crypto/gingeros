// Tool permission model — READ executes immediately, WRITE needs confirmation.
// RBAC mirrors lib/auth can(): viewer=read, sales/admin=write, admin-only tools flagged.
import { can } from "@/lib/auth";

export type ToolKind = "READ" | "WRITE";

export interface ToolPerm { kind: ToolKind; minRole: "viewer" | "sales" | "admin" }

export const TOOL_PERMS: Record<string, ToolPerm> = {
  search_buyers: { kind: "READ", minRole: "viewer" },
  get_buyer: { kind: "READ", minRole: "viewer" },
  get_contacts: { kind: "READ", minRole: "viewer" },
  get_market_summary: { kind: "READ", minRole: "viewer" },
  compare_markets: { kind: "READ", minRole: "viewer" },
  get_pipeline: { kind: "READ", minRole: "viewer" },
  get_opportunities: { kind: "READ", minRole: "viewer" },
  get_followups: { kind: "READ", minRole: "viewer" },
  get_enquiries: { kind: "READ", minRole: "viewer" },
  get_quotes: { kind: "READ", minRole: "viewer" },
  get_exporters: { kind: "READ", minRole: "viewer" },
  get_activity: { kind: "READ", minRole: "viewer" },
  get_stalled: { kind: "READ", minRole: "viewer" },
  sales_brief: { kind: "READ", minRole: "viewer" },
  qualify_buyer: { kind: "READ", minRole: "viewer" },
  summarize_company: { kind: "READ", minRole: "viewer" },
  generate_outreach: { kind: "READ", minRole: "viewer" },
  create_buyer: { kind: "WRITE", minRole: "sales" },
  create_followup: { kind: "WRITE", minRole: "sales" },
  create_enquiry: { kind: "WRITE", minRole: "sales" },
  create_opportunity: { kind: "WRITE", minRole: "sales" },
  create_quote: { kind: "WRITE", minRole: "sales" },
  update_pipeline_stage: { kind: "WRITE", minRole: "sales" },
  update_opportunity: { kind: "WRITE", minRole: "sales" },
  add_note: { kind: "WRITE", minRole: "sales" },
  log_outreach_draft: { kind: "WRITE", minRole: "sales" },
  import_csv: { kind: "WRITE", minRole: "sales" },
  undo_ai_action: { kind: "WRITE", minRole: "sales" },
};

export interface Actor { id: string; email: string; role: string; name: string }

export function actorFrom(user: { id: string; email: string; role: string; name: string } | null): Actor {
  if (!user) return { id: "anon", email: "anonymous", role: "viewer", name: "Guest" };
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}

export function assertToolAccess(actor: Actor, tool: string): void {
  const p = TOOL_PERMS[tool];
  if (!p) throw Object.assign(new Error(`Unknown tool: ${tool}`), { code: "UNKNOWN_TOOL" });
  const need = p.minRole === "viewer" ? "read" : p.minRole === "sales" ? "write" : "admin";
  if (!can(actor.role, need as "read" | "write" | "admin")) {
    throw Object.assign(
      new Error(
        actor.id === "anon"
          ? `Sign in as a sales user to use ${tool}. Reads work as guest; writes do not.`
          : `Role '${actor.role}' cannot use ${tool}. Ask an admin.`
      ),
      { code: "DENIED" }
    );
  }
}

export function toolKind(tool: string): ToolKind {
  return TOOL_PERMS[tool]?.kind ?? "READ";
}
