import { expect, it } from "vitest";
import { parseTldrResponse } from "./tldr";

it("caps AI severity and restores missing deterministic findings", () => {
  const rules = [
    {
      source: "rule" as const,
      ruleId: "srm" as const,
      severity: "critical" as const,
      title: "SRM",
      explanation: "Mismatch",
      action: "Investigate",
    },
  ];
  const summary = parseTldrResponse(
    {
      tldr: "A summary.",
      findings: [
        {
          source: "ai",
          ruleId: null,
          severity: "critical",
          title: "A concern",
          explanation: "Investigate it",
          action: "Look closer",
        },
      ],
    },
    rules,
    "hash",
    "en",
  );
  expect(summary?.findings.map((f) => [f.source, f.severity])).toEqual([
    ["ai", "warning"],
    ["rule", "critical"],
  ]);
  expect(
    parseTldrResponse(
      { tldr: "A summary.", findings: [{ source: "ai", severity: "unknown" }] },
      [],
      "hash",
      "pt",
    ),
  ).toBeNull();
});

it("keeps rule titles stable when the AI renames them", () => {
  const rule = {
    source: "rule" as const,
    ruleId: "srm" as const,
    severity: "critical" as const,
    title: "Possível Sample Ratio Mismatch",
    explanation: "A mismatch.",
    action: "Investigate.",
  };
  const summary = parseTldrResponse(
    { tldr: "A summary.", findings: [{ ...rule, title: "SRM" }] },
    [rule],
    "hash",
    "pt",
  );
  expect(summary?.findings[0]?.title).toBe(rule.title);
});

it("restores missing occurrences of a rule applying to multiple variants", () => {
  const first = {
    source: "rule" as const,
    ruleId: "underpowered" as const,
    severity: "warning" as const,
    title: "Insufficient sample",
    explanation: "Variant B needs more data.",
    action: "Continue.",
  };
  const second = { ...first, explanation: "Variant C needs more data." };
  const summary = parseTldrResponse(
    { tldr: "A summary.", findings: [first] },
    [first, second],
    "hash",
    "en",
  );
  expect(summary?.findings).toEqual([first, second]);
});
