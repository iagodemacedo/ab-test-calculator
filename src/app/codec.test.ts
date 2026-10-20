import { describe, expect, it } from 'vitest';
import { decode, encode, parseState } from './codec';
import { initialState, reducer } from './reducer';

describe('shared calculator links', () => {
  it('round trips both tabs, settings and partial inputs', async () => {
    let state = reducer(initialState('pt'), { type: 'example', tab: 'analysis' });
    state = reducer(state, { type: 'pretest', patch: { weeklyTraffic: '1,5' } });
    const link = await encode(state, 'pt');
    expect(await decode(link.fragment, 'pt')).toEqual(state);
    expect((await decode(link.fragment, 'en'))?.pretest.weeklyTraffic).toBe('1.5');
  });
  it('rejects corrupt, future version and structurally invalid data', async () => {
    expect(await decode('#s=corrompido', 'pt')).toBeNull();
    expect(parseState({ ...initialState('pt'), v: 2 })).toBeNull();
    const invalid = initialState('pt');
    invalid.analysis.groups[1] = { ...invalid.analysis.groups[0]!, id: 'A' };
    expect(parseState(invalid)).toBeNull();
    expect(parseState({ ...initialState('pt'), plan: { days: 4 } })).toBeNull();
  });
  it('omits only the TL;DR when the full URL exceeds the share limit', async () => {
    const state = initialState('en');
    state.tldr = { tldr: 'A summary.', inputHash: 'test', locale: 'en', generatedAt: new Date().toISOString(), findings: [] };
    const link = await encode(state, 'en', 7990);
    expect(link.omittedTldr).toBe(true);
    expect((await decode(link.fragment, 'en'))?.tldr).toBeNull();
  });
});
