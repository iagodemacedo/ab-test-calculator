import { describe, expect, it } from "vitest";
import { parseModelOutput } from "./response";
import { requestFixture } from "./test-fixture";

const finding = { source: "rule", ruleId: "srm", severity: "info", title: "Divisão desigual",
  explanation: "O p-valor de SRM é 0,0000018.", action: "Verifique a distribuição de tráfego." };
const output = { tldr: "A diferença ainda é inconclusiva. Verifique o SRM antes de decidir.", findings: [finding] };

describe("parseModelOutput", () => {
  it("forces deterministic severity", () => {
    expect(parseModelOutput(output, requestFixture())?.findings[0]?.severity).toBe("critical");
  });
  it("downgrades critical AI findings", () => {
    expect(parseModelOutput({ ...output, findings: [{ ...finding, source: "ai", ruleId: null, severity: "critical" }] }, requestFixture())
      ?.findings[0]).toMatchObject({ source: "ai", ruleId: null, severity: "warning" });
  });
  it.each([JSON.stringify(output), "```json\n" + JSON.stringify(output) + "\n```"])("accepts JSON strings and fenced JSON", raw => {
    expect(parseModelOutput(raw, requestFixture())?.tldr).toBe(output.tldr);
  });
  it("drops unknown and unsupplied rules", () => {
    expect(parseModelOutput({ ...output, findings: [{ ...finding, ruleId: "unknown" }, { ...finding, ruleId: "low_data" }] }, requestFixture())
      ?.findings).toEqual([]);
  });
  it("leaves missing rules for the UI fallback", () => {
    expect(parseModelOutput({ ...output, findings: [] }, requestFixture())?.findings).toEqual([]);
  });
  it.each([{}, { ...output, tldr: " " }, { ...output, tldr: 1 }, { ...output, findings: {} }, "bad json",
    { ...output, findings: [{ ...finding, source: "other" }] },
    { ...output, findings: [{ ...finding, ruleId: null }] },
    { ...output, findings: [{ ...finding, source: "ai" }] },
    { ...output, findings: [{ ...finding, explanation: "" }] },
    { ...output, findings: [{ ...finding, action: null }] },
    { ...output, findings: [{ ...finding, severity: "fatal" }] },
  ])("rejects invalid model schema %j", raw => {
    expect(parseModelOutput(raw, requestFixture())).toBeNull();
  });
});
