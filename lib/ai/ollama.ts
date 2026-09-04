// Ollama-backed AIProvider (chat + tools). Server-side only — keys never reach the browser.
// Env: OLLAMA_BASE_URL (default http://127.0.0.1:11434), OLLAMA_MODEL, OLLAMA_API_KEY.
import type { z } from "zod";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; function: { name: string; arguments: Record<string, unknown> } }[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown> }

function zodToJson(s: unknown): Record<string, unknown> {
  const t = s as { _def: Record<string, unknown>; description?: string };
  const def = t._def ?? {};
  const typeName = String((def as { typeName?: string }).typeName ?? "");
  const desc = t.description ? { description: t.description } : {};
  switch (typeName) {
    case "ZodString": return { type: "string", ...desc };
    case "ZodNumber": return { type: "number", ...desc };
    case "ZodBoolean": return { type: "boolean", ...desc };
    case "ZodEnum": return { type: "string", enum: (def as { values?: string[] }).values ?? [], ...desc };
    case "ZodLiteral": return { const: (def as { value?: unknown }).value, ...desc };
    case "ZodArray": return { type: "array", items: zodToJson((def as { type?: unknown }).type), ...desc };
    case "ZodDefault": return zodToJson((def as { innerType?: unknown }).innerType);
    case "ZodOptional": return zodToJson((def as { innerType?: unknown }).innerType);
    case "ZodObject": {
      const raw = (def as { shape?: unknown }).shape;
      const shape = (typeof raw === "function" ? (raw as () => Record<string, unknown>)() : raw ?? {}) as Record<string, unknown>;
      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        props[k] = zodToJson(v);
        const inner = (v as { _def?: { typeName?: string } })._def?.typeName;
        if (inner !== "ZodOptional" && inner !== "ZodDefault") required.push(k);
      }
      return { type: "object", properties: props, required, ...desc };
    }
    default: return { ...desc };
  }
}

export function toolSpec(name: string, description: string, schema: z.ZodTypeAny): ToolSpec {
  return { name, description, parameters: zodToJson(schema) };
}

export function ollamaConfig() {
  let base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  base = base.replace(/\/+$/, "").replace(/\/api$/, ""); // accept host- or api-root forms
  return {
    base,
    model: process.env.OLLAMA_MODEL || "gemma4:31b-cloud",
    key: process.env.OLLAMA_API_KEY || "",
  };
}

export async function ollamaChat(messages: ChatMessage[], tools: ToolSpec[], timeoutMs = 90000): Promise<{ content: string; tool_calls: { id: string; name: string; arguments: Record<string, unknown> }[] }> {
  const { base, model, key } = ollamaConfig();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base}/api/chat`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model,
        messages: messages.map((m) =>
          m.role === "tool"
            ? { role: "tool" as const, content: m.content }
            : m.role === "assistant" && m.tool_calls
              ? { role: "assistant" as const, content: m.content, tool_calls: m.tool_calls.map((c) => ({ id: c.id, function: { name: c.function.name, arguments: c.function.arguments } })) }
              : { role: m.role as "system" | "user" | "assistant", content: m.content }
        ),
        tools: tools.map((fn) => ({ type: "function", function: fn })),
        stream: false,
        options: { temperature: 0.2 },
      }),
    });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { message?: { content?: string; tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] } };
    const msg = j.message ?? {};
    return {
      content: String(msg.content ?? ""),
      tool_calls: (msg.tool_calls ?? []).map((c, i) => ({
        id: String(c.id ?? `call_${i}`),
        name: String(c.function?.name ?? ""),
        arguments: (typeof c.function?.arguments === "string" ? JSON.parse(c.function.arguments) : c.function?.arguments ?? {}) as Record<string, unknown>,
      })),
    };
  } finally {
    clearTimeout(t);
  }
}

// Backup: model emits fenced {"tool": name, "args": {...}} blocks instead of tool_calls.
export function parseActionBlocks(text: string): { name: string; arguments: Record<string, unknown> }[] {
  const out: { name: string; arguments: Record<string, unknown> }[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/g)) {
    try {
      const o = JSON.parse(m[1]) as { tool?: string; args?: Record<string, unknown> };
      if (o.tool) out.push({ name: o.tool, arguments: o.args ?? {} });
    } catch { /* ignore */ }
  }
  return out;
}
