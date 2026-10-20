import { expect, it } from 'vitest';
import { analyze } from '../stats';
import { initialState, reducer } from './reducer';
import { parseAnalysis } from './parse';
import { parseTldrResponse, tldrRequest } from './tldr';
import { parseTldrRequest } from '../../worker/payload';

it('sends the exact numerical contract, including one-sided infinite interval handling', () => {
  let state = reducer(initialState('pt'), { type: 'example', tab: 'analysis' });
  state = reducer(state, { type: 'analysis', patch: { method: 'ztest' } });
  state = reducer(state, { type: 'settings', patch: { hypothesis: 'one-sided' } });
  const parsed = parseAnalysis(state.analysis, state.currency, null, 'pt');
  expect(parsed.kind).toBe('ok');
  if (parsed.kind !== 'ok') return;
  const result = analyze(parsed.input, state.settings);
  expect(result.kind).toBe('ok');
  if (result.kind !== 'ok') return;
  const request = tldrRequest(state, parsed.input, result, 'pt', 'test-token');
  expect(request.variants[0]?.ciRelative).toBeNull();
  expect(parseTldrRequest(JSON.parse(JSON.stringify(request))).ok).toBe(true);
  expect(JSON.stringify(request)).not.toContain('inputHash');
});
it('caps AI severity and restores missing deterministic findings', () => {
  const rules = [{ source: 'rule' as const, ruleId: 'srm' as const, severity: 'critical' as const, title: 'SRM', explanation: 'Mismatch', action: 'Investigate' }];
  const summary = parseTldrResponse({ tldr: 'A summary.', findings: [{ source: 'ai', ruleId: null, severity: 'critical', title: 'A concern', explanation: 'Investigate it', action: 'Look closer' }] }, rules, 'hash', 'en');
  expect(summary?.findings.map(f => [f.source, f.severity])).toEqual([['ai', 'warning'], ['rule', 'critical']]);
  expect(parseTldrResponse({ tldr: 'A summary.', findings: [{ source: 'ai', severity: 'unknown' }] }, [], 'hash', 'pt')).toBeNull();
});
