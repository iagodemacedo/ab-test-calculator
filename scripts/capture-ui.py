#!/usr/bin/env python3
"""Capture the visual matrix through ctl without generating an AI summary."""
import json
import os
import subprocess
from pathlib import Path

ctl = '.claude/skills/verify-ab-test-calculator/scripts/ctl'
run = os.environ['ABCALC_RUN_ID']
ev = Path('artifacts/verify') / run / 'visual'
ev.mkdir(parents=True, exist_ok=True)
log = (ev / 'commands.jsonl').open('w')

def call(*args):
    result = subprocess.run([ctl, *args], text=True, capture_output=True)
    log.write(json.dumps({'args': args, 'code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}, ensure_ascii=False) + '\n')
    log.flush()
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return json.loads(result.stdout) if args[0] == 'browser' else result.stdout

def click(role, name):
    return call('browser', 'click', '--role', role, '--name', name, '--exact')

try:
    call('doctor')
    call('browser', 'start')
    call('browser', 'goto', '/pt/analise')
    click('button', 'Preencher com dados de exemplo')
    for tab in ('analysis', 'pretest'):
        if tab == 'pretest':
            click('link', 'Pré-teste')
            click('button', 'Preencher com dados de exemplo')
        for theme in ('light', 'dark'):
            if call('browser', 'attr', '--css', 'html', '--attr', 'data-theme')['value'] != theme:
                click('button', 'Alternar tema')
            for viewport in ('1440x1000', '390x844'):
                for full in (False, True):
                    name = f'{tab}-{theme}-{viewport}' + ('-full' if full else '')
                    call('browser', 'screenshot', '--path', str(ev / (name + '.png')), '--viewport', viewport, *(('--full',) if full else ()))
                titles = ('Distribuições das CRs', 'Distribuição do lift') if tab == 'analysis' else ('MDE × semanas',)
                for title in titles:
                    name = 'rate' if 'CRs' in title else 'lift' if 'lift' in title else 'mde'
                    call('browser', 'screenshot', '--css', f'figure:has(> h3:text-is("{title}"))', '--path', str(ev / f'{name}-{theme}-{viewport}.png'), '--viewport', viewport)
    (ev / 'result.json').write_text(json.dumps({'status': 'PASS', 'screenshots': len(list(ev.glob('*.png'))), 'real_generations': 0}))
finally:
    log.close()
    print(subprocess.run([ctl, 'cleanup'], text=True, capture_output=True).stdout)
