import IconCritical from '~icons/ph/warning-octagon';
import IconWarning from '~icons/ph/warning';
import IconInfo from '~icons/ph/info';
import IconSparkle from '~icons/ph/sparkle';
import { RULE_SEVERITY } from '../stats/types';
import type { Finding, TldrFinding } from '../stats/types';
import type { ContentPack } from '../i18n/content/types';
import type { Formatter } from '../app/format';
import type { Ui } from '../i18n/ui';

export function ruleFindings(findings: Finding[], content: ContentPack, fmt: Formatter): TldrFinding[] {
  return findings.map(f => ({ source: 'rule', ruleId: f.rule, severity: RULE_SEVERITY[f.rule], ...content.finding(f, fmt) }));
}
export function Findings({ findings, t }: { findings: TldrFinding[]; t: Ui }) {
  const order = { critical: 0, warning: 1, info: 2 };
  const sorted = findings.map(f => f.source === 'ai' && f.severity === 'critical' ? { ...f, severity: 'warning' as const } : f).sort((a, b) => order[a.severity] - order[b.severity] || (a.source === b.source ? 0 : a.source === 'rule' ? -1 : 1));
  return <ul>{sorted.map((finding, i) => {
    const Icon = finding.severity === 'critical' ? IconCritical : finding.severity === 'warning' ? IconWarning : IconInfo;
    return <li class="finding" key={i}><Icon aria-hidden="true" class={finding.severity} /><div><h3 class="finding-title"><span class={`severity ${finding.severity}`}>{t[finding.severity]}</span>{finding.title}{finding.source === 'ai' && <span class="badge"><IconSparkle aria-hidden="true" />{t.fromAi}</span>}</h3><p>{finding.explanation}</p><p class="action">{finding.action}</p></div></li>;
  })}</ul>;
}
