// The four verdict states (PRD section 8). Each method decides whether there is a winner or a
// loser; when it cannot, the achieved MDE splits "no relevant difference" from "underpowered".
import type { Hypothesis, Verdict } from "./types";

type Decision = "winner" | "loser" | null;

function inconclusive(achievedMde: number, referenceLift: number): Verdict {
  return achievedMde <= referenceLift ? "no-difference" : "underpowered";
}

export function verdictZ(
  significant: boolean,
  absoluteDiff: number,
  hypothesis: Hypothesis,
  achievedMde: number,
  referenceLift: number,
): Verdict {
  let decision: Decision = null;
  if (significant && absoluteDiff > 0) decision = "winner";
  else if (significant && absoluteDiff < 0 && hypothesis === "two-sided") decision = "loser";
  return decision ?? inconclusive(achievedMde, referenceLift);
}

export function verdictBayes(probabilityToBeatControl: number, confidence: number, achievedMde: number, referenceLift: number): Verdict {
  let decision: Decision = null;
  if (probabilityToBeatControl >= confidence) decision = "winner";
  else if (probabilityToBeatControl <= 1 - confidence) decision = "loser";
  return decision ?? inconclusive(achievedMde, referenceLift);
}
