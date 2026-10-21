import type { TldrRequest, TldrResponse } from "../src/shared/tldr-contract";
import { RULE_SEVERITY } from "../src/stats/types";
import { isRecord, isRuleId } from "./payload";

export const TLDR_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tldr", "findings"],
  properties: {
    tldr: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["source", "ruleId", "severity", "title", "explanation", "action"],
        properties: {
          source: { type: "string", enum: ["rule", "ai"] },
          ruleId: { anyOf: [{ type: "string", enum: Object.keys(RULE_SEVERITY) }, { type: "null" }] },
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          title: { type: "string" }, explanation: { type: "string" }, action: { type: "string" },
        },
      },
    },
  },
};

export function parseModelOutput(raw: unknown, req: TldrRequest): TldrResponse | null {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
    catch { return null; }
  }
  if (!isRecord(raw) || typeof raw.tldr !== "string" || !raw.tldr.trim() || !Array.isArray(raw.findings)) return null;
  const findings: TldrResponse["findings"] = [];
  for (const f of raw.findings) {
    if (!isRecord(f) || !Object.hasOwn(f, "ruleId")) return null;
    if (f.ruleId !== null && !isRuleId(f.ruleId)) continue;
    if ((f.source !== "rule" && f.source !== "ai") ||
        (f.severity !== "critical" && f.severity !== "warning" && f.severity !== "info") ||
        typeof f.title !== "string" || !f.title.trim() || typeof f.explanation !== "string" || !f.explanation.trim() ||
        typeof f.action !== "string" || !f.action.trim()) return null;
    if (f.source === "rule") {
      if (!isRuleId(f.ruleId)) return null;
      if (!req.findings.some(input => input.rule === f.ruleId)) continue;
      findings.push({ source: "rule", ruleId: f.ruleId, severity: RULE_SEVERITY[f.ruleId],
        title: f.title, explanation: f.explanation, action: f.action });
    } else {
      if (f.ruleId !== null) return null;
      findings.push({ source: "ai", ruleId: null, severity: f.severity === "critical" ? "warning" : f.severity,
        title: f.title, explanation: f.explanation, action: f.action });
    }
  }
  return { tldr: raw.tldr.trim(), findings, model: "" };
}
