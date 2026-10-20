#!/usr/bin/env python3
"""Drive the acceptance journeys exclusively through the project's ctl interface."""
import argparse
import json
import os
import re
import subprocess
import time
from urllib.parse import unquote, urlsplit
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--live-tldr', action='store_true')
args = parser.parse_args()
ctl = '.claude/skills/verify-ab-test-calculator/scripts/ctl'
run = os.environ['ABCALC_RUN_ID']
ev = Path('artifacts/verify') / run
for feature in ('analysis', 'pretest', 'share', 'locale-theme', 'tldr'):
    (ev / feature).mkdir(parents=True, exist_ok=True)
log = (ev / 'commands.jsonl').open('a')
results = {}

def command(*parts):
    call = subprocess.run([ctl, *parts], text=True, capture_output=True)
    log.write(json.dumps({'command': list(parts), 'code': call.returncode, 'stdout': call.stdout, 'stderr': call.stderr}, ensure_ascii=False) + '\n')
    log.flush()
    if call.returncode:
        raise RuntimeError(f'{parts}: {call.stdout} {call.stderr}')
    if parts[0] != 'browser':
        return call.stdout
    data = json.loads(call.stdout.splitlines()[-1])
    if not data['ok']:
        raise RuntimeError(str(data))
    return data

def browser(*parts): return command('browser', *parts)
def click(role, name, *more): return browser('click', '--role', role, '--name', name, '--exact', *more)
def fill(name, value, *more): return browser('fill', '--role', 'spinbutton', '--name', name, '--exact', '--value', str(value), *more)
def text(name='Resultados'): return browser('text', '--role', 'region', '--name', name, '--exact')['text']
def snap(feature, suffix, region=None):
    parts = ('--role', 'region', '--name', region, '--exact') if region else ()
    browser('snapshot', *parts, '--path', str(ev / feature / f'{suffix}.aria.txt'))
def shot(feature, suffix, viewport='1440x1000', scheme=None):
    more = ('--color-scheme', scheme) if scheme else ()
    browser('screenshot', '--path', str(ev / feature / f'{suffix}.png'), '--full', '--viewport', viewport, *more)
def check(condition, message):
    if not condition: raise AssertionError(message)
def values(feature, name, value):
    with (ev / feature / 'values.txt').open('a') as out: out.write(name + '\n' + value + '\n\n')
def fixture(srm=False):
    click('button', 'Limpar')
    fill('Dias de teste', 14)
    fill('Usuários (Controle)', 50000 if srm else 80000)
    fill('Conversões (Controle)', 1000 if srm else 1600)
    fill('Usuários (Variante B)', 48500 if srm else 80000)
    fill('Conversões (Variante B)', 1000 if srm else 1696)
def journey(name, fn):
    try:
        fn()
        results[name] = {'status': 'PASS'}
        if name == 'tldr' and not args.live_tldr:
            results[name] = {'status': 'NOT RUN', 'reason': 'Fallback passed. Live generation and stale state were not exercised in this run.'}
        print(f"{results[name]['status']} {name}", flush=True)
    except Exception as error:
        results[name] = {'status': 'FAIL', 'reason': str(error)}
        print(f'FAIL {name}: {error}', flush=True)
        try: snap(name if name in ('analysis','pretest','tldr') else 'locale-theme', 'failure')
        except Exception: pass


def analysis():
    browser('goto', '/pt/analise')
    fixture()
    snap('analysis', 'results-bayes', 'Resultados')
    result = text()
    values('analysis', 'bayes', result)
    check('Vencedora' in result and re.search(r'95,[0-9]%', result), result)
    shot('analysis', 'page-bayes')
    click('radio', 'Z test')
    check(browser('attr', '--role', 'radio', '--name', 'Bicaudal', '--attr', 'aria-checked')['value'] == 'true', 'Two-sided is not default')
    result = text()
    values('analysis', 'ztest-2s', result)
    check(all(value in result for value in ['0,0911', '1,6897', 'Inconclusiva, sem poder', 'Dias adicionais necessários\n1']), result)
    alerts = text('Alertas')
    check('Amostra insuficiente' in alerts and 'métodos discordam' in alerts and 'Sample Ratio' not in alerts, alerts)
    snap('analysis', 'results-ztest-2s', 'Resultados')
    snap('analysis', 'alerts-ztest-2s', 'Alertas')
    shot('analysis', 'page-ztest-2s')
    click('radio', 'Unicaudal', '--wait-text', 'Vencedora')
    result = text()
    check('0,0455' in result and 'Vencedora' in result, result)
    values('analysis', 'ztest-1s', result)
    snap('analysis', 'results-ztest-1s', 'Resultados')
    shot('analysis', 'page-ztest-1s')
    fill('Usuários (Controle)', 50000)
    fill('Conversões (Controle)', 1000)
    fill('Usuários (Variante B)', 48500)
    fill('Conversões (Variante B)', 1000)
    alerts = text('Alertas')
    check('Possível Sample Ratio Mismatch' in alerts and 'Crítico' in alerts, alerts)
    values('analysis', 'srm', alerts)
    snap('analysis', 'alerts-srm', 'Alertas')
    snap('analysis', 'results-srm', 'Resultados')
    shot('analysis', 'page-srm')
    click('button', 'Adicionar variante')
    check(browser('attr', '--role', 'switch', '--name', 'Correção de Bonferroni', '--attr', 'aria-checked')['value'] == 'true', 'Bonferroni not checked')
    snap('analysis', 'added-variant')
    click('button', 'Remover Variante C')
    snap('analysis', 'removed-variant')


def pretest():
    click('button', 'Limpar')
    click('link', 'Pré-teste', '--wait-url', '/pt/pre-teste')
    snap('pretest', 'empty')
    fill('Tráfego semanal', 10000)
    fill('Conversões semanais', 300)
    table = browser('text', '--role', 'table', '--name', 'MDE por semana', '--exact')['text']
    check(all(x in table for x in ['34,40%', '23,79%', '19,23%', '16,55%', '5.000', '10.000', '15.000', '20.000']), table)
    check('só detecta efeitos grandes' in text(), text())
    values('pretest', 'mode-a', table)
    snap('pretest', 'mode-a')
    shot('pretest', 'mode-a')
    click('radio', 'Quero detectar X%: do que preciso?')
    fill('Lift alvo', 10)
    result = text()
    check('53.211' in result and '75 dias' in result, result)
    check('passa de 12 semanas' not in result, result)
    values('pretest', 'mode-b', result)
    snap('pretest', 'mode-b')
    click('radio', 'Semanal')
    boundaries = browser('text', '--role', 'table', '--name', 'Fronteiras', '--exact')['text']
    check('11' in boundaries, boundaries)
    values('pretest', 'sequential', text())
    snap('pretest', 'sequential')
    click('button', 'Usar esse plano', '--wait-url', '/pt/analise')
    check('Plano de' in browser('text', '--css', 'main')['text'], 'Plan seal absent')
    check(browser('attr', '--role', 'switch', '--name', 'Teste em andamento', '--attr', 'aria-checked')['value'] == 'true', 'Sequential plan not inherited')
    snap('pretest', 'plan-on-analysis')
    shot('pretest', 'plan-on-analysis')


def share():
    browser('goto', '/pt/analise')
    fixture()
    click('radio', 'Z test')
    click('radio', 'Unicaudal')
    click('button', 'Salvar e compartilhar link', '--wait-text', 'Link copiado')
    link = browser('clipboard')['text']
    (ev / 'share' / 'link.txt').write_text(link)
    check('/pt/analise#s=' in link, link)
    time.sleep(.6)
    browser('goto', '/pt/analise')
    check(browser('value', '--role', 'spinbutton', '--name', 'Usuários (Controle)', '--exact')['value'] == '80000', 'Draft not restored')
    storage = browser('storage')
    check('abcalc-draft-v1' in storage['keys'], str(storage))
    values('share', 'draft', json.dumps(storage))
    click('button', 'Limpar')
    time.sleep(.6)
    check('abcalc-draft-v1' not in browser('storage')['keys'], 'Draft was recreated after clear')
    browser('goto', 'about:blank')
    browser('goto', link)
    check('Vencedora' in text(), text())
    snap('share', 'restored')
    shot('share', 'restored')
    fill('Dias de teste', 1)
    time.sleep(.6)
    browser('goto', 'about:blank')
    browser('goto', link)
    check('seu rascunho anterior foi substituído pelo link' in browser('text', '--css', 'body')['text'], 'Replacement notice absent')
    browser('network', '--path', str(ev / 'share' / 'network.json'))
    network = (ev / 'share' / 'network.json').read_text()
    check('#s=' not in network and '1696' not in network, 'Private fragment or data sent to network')
    browser('goto', 'about:blank')
    browser('goto', '/pt/analise#s=corrompido')
    check('Não foi possível ler este link' in browser('text', '--css', 'body')['text'], 'Invalid-link notice absent')
    check(browser('value', '--role', 'spinbutton', '--name', 'Usuários (Controle)', '--exact')['value'] == '', 'Invalid link restored a draft')
    snap('share', 'invalid')


def locale_theme():
    browser('goto', '/pt/analise')
    fixture()
    click('link', 'EN', '--wait-url', '/en/analysis')
    result = text('Results')
    check('6.00%' in result, result)
    check(browser('value', '--role', 'spinbutton', '--name', 'Users (Controle)', '--exact')['value'] == '80000', 'Language switch lost inputs')
    snap('locale-theme', 'en')
    shot('locale-theme', 'en')
    click('link', 'PT', '--wait-url', '/pt/analise')
    check('6,00%' in text(), text())
    browser('goto', '/', '--wait-ready', 'false', '--wait-url', '/en/analysis')
    values('locale-theme', 'root-default-en', browser('url')['url'])
    browser('goto', '/pt/analise', '--color-scheme', 'dark')
    check(browser('attr', '--css', 'html', '--attr', 'data-theme', '--color-scheme', 'dark')['value'] == 'dark', 'System dark not applied')
    shot('locale-theme', 'dark', scheme='dark')
    click('button', 'Alternar tema', '--color-scheme', 'dark')
    browser('goto', '/pt/analise', '--color-scheme', 'dark')
    check(browser('attr', '--css', 'html', '--attr', 'data-theme')['value'] == 'light', 'Manual light theme not persisted')
    shot('locale-theme', 'light-override')
    for tab in ('analysis', 'pretest'):
        if tab == 'pretest':
            click('link', 'Pré-teste')
            fill('Tráfego semanal', 10000)
            fill('Conversões semanais', 300)
        for theme in ('light', 'dark'):
            current = browser('attr', '--css', 'html', '--attr', 'data-theme')['value']
            if current != theme: click('button', 'Alternar tema')
            for viewport in ('1440x1000', '390x844'):
                shot('locale-theme', f'{tab}-{theme}-{viewport}', viewport)
    browser('screenshot', '--path', str(ev / 'locale-theme' / 'pretest-desktop-final.png'), '--viewport', '1440x1000')


def tldr():
    browser('goto', '/pt/analise')
    fixture(srm=True)
    snap('tldr', 'before')
    fragment = urlsplit(browser('url')['url']).fragment
    click('button', 'Gerar TL;DR', '--block', '/api/tldr', '--wait-text', 'TL;DR indisponível', '--timeout', '30000', '--record', str(ev / 'tldr' / 'fallback-requests.json'))
    requests = json.loads((ev / 'tldr' / 'fallback-requests.json').read_text())
    sent = unquote(unquote(json.dumps(requests)))
    check('#s=' not in sent and (not fragment or fragment not in sent), 'Fragment sent during Turnstile or TLDR request')
    fallback = text('TL;DR')
    check('Possível Sample Ratio Mismatch' in fallback and 'Crítico' in fallback, fallback)
    snap('tldr', 'fallback', 'TL;DR')
    shot('tldr', 'fallback')
    results['tldr-fallback'] = {'status': 'PASS'}
    if not args.live_tldr:
        results['tldr-stale'] = {'status': 'NOT RUN', 'reason': 'Needs a generated summary.'}
        results['tldr-live'] = {'status': 'NOT RUN', 'reason': 'No live call requested in this run. Respect the task-wide real generation budget.'}
        return
    click('button', 'Gerar TL;DR', '--wait-text', 'Gerado por IA em', '--timeout', '30000', '--record', str(ev / 'tldr' / 'requests.json'))
    generated = text('TL;DR')
    check('Possível Sample Ratio Mismatch' in generated and 'Crítico' in generated, generated)
    values('tldr', 'generated', generated)
    snap('tldr', 'generated', 'TL;DR')
    shot('tldr', 'generated')
    fill('Conversões (Variante B)', 1001, '--wait-text', 'Dados mudaram')
    snap('tldr', 'stale', 'TL;DR')
    payloads = json.loads((ev / 'tldr' / 'requests.json').read_text())
    check(all('#s=' not in request['url'] for request in payloads), 'Fragment in TLDR request URL')
    request = next(request for request in payloads if request['method'] == 'POST' and '/api/tldr' in request['url'])
    payload = json.loads(request['body'])
    check(all(len(group['name']) <= 40 for group in payload['groups']), 'Group name too long')
    results['tldr-live'] = {'status': 'PASS'}

try:
    command('doctor')
    for name, fn in [('analysis', analysis), ('pretest', pretest), ('share-and-draft', share), ('locale-theme', locale_theme), ('tldr', tldr)]: journey(name, fn)
finally:
    (ev / 'journeys.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    log.close()
    command_result = subprocess.run([ctl, 'cleanup'], text=True, capture_output=True)
    print(command_result.stdout, flush=True)
if any(result['status'] == 'FAIL' for result in results.values()): raise SystemExit(1)
