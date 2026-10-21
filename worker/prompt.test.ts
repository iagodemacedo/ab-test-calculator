import { describe, expect, it } from "vitest";
import type { TldrRequest } from "../src/shared/tldr-contract";
import { buildMessages } from "./prompt";
import { requestFixture } from "./test-fixture";

function system(change: (req: TldrRequest) => void = () => {}): string {
  const req = requestFixture();
  change(req);
  return buildMessages(req)[0]!.content;
}

describe("TL;DR prompt", () => {
  it("in pt-BR asks for achado(s) and forbids the English word finding in the texts", () => {
    const pt = system();
    expect(pt).toContain("pt-BR");
    expect(pt).toMatch(/"achado".*"achados".*never use the English word "finding"/);
    const en = system(req => { req.locale = "en"; });
    expect(en).not.toContain("achado");
    expect(en).not.toContain("pt-BR");
  });

  it("leads with SRM as not trustworthy yet when SRM fired, before any other critical rule", () => {
    const lead = /first sentence of tldr must say that ([^.]*)/;
    expect(system().match(lead)?.[1]).toContain("not trustworthy yet");
    expect(system().match(lead)?.[1]).toContain("sample ratio mismatch");
    const both = system(req => {
      req.findings = [{ rule: "stopped_early", variant: "B", current: 100, planned: 200 }, { rule: "srm", pValue: 0.001 }];
    });
    expect(both).toContain("critical rule finding is present (srm)");
    const early = system(req => { req.findings = [{ rule: "stopped_early", variant: "B", current: 100, planned: 200 }]; });
    expect(early).toContain("critical rule finding is present (stopped_early)");
    expect(early).toContain("planned sample");
  });

  it("leads with the verdict when no critical rule fired", () => {
    const calm = system(req => { req.findings = [{ rule: "underpowered", variant: "B", referenceLift: 0.1 }]; });
    expect(calm).not.toContain("critical rule finding is present");
    expect(calm).toContain("Lead the tldr with the verdict.");
  });

  it("mentions per-variant revenue only when it is present", () => {
    expect(system()).toContain("do not mention revenue");
    const paid = system(req => {
      req.revenue = { currency: "BRL", horizonMonths: 6, perVariant: [{ id: "B", monthlyContribution: 100, horizonImpact: 600 }] };
    });
    expect(paid).not.toContain("do not mention revenue");
    expect(paid).toContain("revenue.perVariant");
  });

  it("states the deterministic severities from the rule registry", () => {
    expect(system()).toContain("Critical: srm, stopped_early.");
  });
});
