import type { ContentPack, ConceptId, ExplanationContext } from '../i18n/content/types';
import type { Ui } from '../i18n/ui';
import { track } from '../app/analytics';

function FormulaText({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => i % 2 ? <code key={i}>{part}</code> : part)}</>;
}
export function Explanation({ id, content, context, t }: { id: ConceptId; content: ContentPack; context: ExplanationContext | null; t: Ui }) {
  const explanation = content.explanations[id];
  const numbers = Object.values(context ?? {}).filter((v): v is string => typeof v === 'string' && v.length > 0).sort((a, b) => b.length - a.length);
  const sentence = explanation.layer1(context);
  const parts = numbers.length ? sentence.split(new RegExp(`(${numbers.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')) : [sentence];
  return <details class="explanation" onToggle={e => { if (e.currentTarget.open) track('explanation_opened', { concept: id }); }}><summary>{explanation.title} <span aria-hidden="true">?</span></summary><p>{parts.map((part, i) => numbers.includes(part) ? <span class="dynamic" key={i}>{part}</span> : part)}</p><details class="technical"><summary>{t.more}</summary>{explanation.layer2.split('\n\n').map((p, i) => <p key={i}><FormulaText text={p} /></p>)}</details></details>;
}
