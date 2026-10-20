#!/usr/bin/env python3
"""Additional browser checks for calculator boundaries and static routes."""
import json
import os
import subprocess
from pathlib import Path

ctl = '.claude/skills/verify-ab-test-calculator/scripts/ctl'
run = os.environ['ABCALC_RUN_ID']
ev = Path('artifacts/verify') / run / 'extra'
ev.mkdir(parents=True, exist_ok=True)
log = (ev / 'commands.jsonl').open('a')
results = {}

def call(*args):
    output = subprocess.run([ctl, *args], text=True, capture_output=True)
    log.write(json.dumps({'args': args, 'code': output.returncode, 'stdout': output.stdout, 'stderr': output.stderr}, ensure_ascii=False) + '\n')
    log.flush()
    if output.returncode: raise RuntimeError(output.stdout + output.stderr)
    return json.loads(output.stdout) if args[0] == 'browser' else output.stdout

def browser(*args): return call('browser', *args)
def click(role, name, *more): return browser('click', '--role', role, '--name', name, '--exact', *more)
def fill(name, value, *more): return browser('fill', '--role', 'spinbutton', '--name', name, '--exact', '--value', str(value), *more)
def text(region='Resultados'): return browser('text', '--role', 'region', '--name', region, '--exact')['text']
def snapshot(name): return browser('snapshot', '--path', str(ev / f'{name}.aria.txt'))
def check(condition, evidence):
    if not condition: raise AssertionError(str(evidence))
def scenario(name, fn):
    try:
        fn()
        results[name] = 'PASS'
        print(f'PASS {name}', flush=True)
    except Exception as error:
        results[name] = str(error)
        print(f'FAIL {name}: {error}', flush=True)
        try: snapshot(f'{name}-failure')
        except Exception: pass

def example():
    click('button', 'Limpar')
    click('button', 'Preencher com dados de exemplo')

def entries():
    browser('goto', '/', '--wait-url', '/pt/analise')
    browser('goto', '/pt', '--wait-url', '/pt/analise')
    browser('goto', '/en', '--wait-url', '/en/analysis')
    for path, title in [('/pt/sobre', 'Sobre e metodologia'), ('/en/about', 'About and methodology')]:
        response = browser('goto', path, '--wait-ready', 'false')
        check(title in response['title'], response)
        body = browser('text', '--css', 'main')['text']
        check(all(value in body for value in ['Beta(1,1)', 'SEdiff', 'stopped_early', 'Umami', 'Lan-DeMets']), body)
        snapshot(path.split('/')[-1])
    response = browser('goto', '/pt/nao-existe', '--wait-ready', 'false')
    check(response['status'] == 404 and 'Página não encontrada' in response['title'], response)
    snapshot('404-pt')
    browser('goto', '/pt/analise')

def invalid():
    example()
    fill('Conversões (Variante B)', 80001)
    check('As conversões não podem superar os usuários.' in browser('text', '--css', 'main')['text'], 'Invalid count not shown')
    check(browser('attr', '--role', 'button', '--name', 'Gerar TL;DR', '--attr', 'disabled')['value'] is not None, 'TLDR still enabled')
    snapshot('invalid-count')
    fill('Conversões (Variante B)', 1696)
    fill('Split pretendido (Controle)', 49)
    check('Os splits precisam somar 100%.' in browser('text', '--css', 'main')['text'], 'Invalid split not shown')
    snapshot('invalid-split')
    fill('Split pretendido (Controle)', 50)
    fill('Conversões (Controle)', 0)
    result = text()
    check('Sem conversões no controle' in result and 'Diferença absoluta' in result, result)
    check('Infinity' not in result and 'NaN' not in result, result)
    snapshot('zero-control')
    fill('Conversões (Variante B)', 0)
    check('Sem conversões, não há o que comparar.' in text(), text())
    snapshot('zero-all')

def slots():
    example()
    for _ in range(3): click('button', 'Adicionar variante')
    marker = '.group-name:has(input[aria-label="Nome do grupo D"]) .series-marker'
    before = browser('attr', '--css', marker, '--attr', 'style')['value']
    snapshot('five-groups')
    check('button "Adicionar variante"' not in (ev / 'five-groups.aria.txt').read_text(), 'Allows more than 5 groups')
    click('button', 'Remover Variante C')
    after = browser('attr', '--css', marker, '--attr', 'style')['value']
    check(before == after and '--series-4' in after, (before, after))
    snapshot('stable-slots')
    example()

def explanations():
    click('radio', 'Z test')
    click('button', 'Adicionar variante')
    fill('Usuários (Variante C)', 80000)
    fill('Conversões (Variante C)', 1600)
    for concept in ['bayes', 'ztest', 'bayes-vs-z', 'p-value', 'confidence-power', 'hypothesis', 'bonferroni', 'peeking-sequential']:
        browser('click', '--css', f'[data-concept="{concept}"] > summary')
        browser('click', '--css', f'[data-concept="{concept}"] .technical > summary')
        content = browser('text', '--css', f'[data-concept="{concept}"]')['text']
        check(len(content) > 300, content)
        snapshot(f'explain-{concept}')
    click('radio', 'Bayesiano')
    browser('click', '--css', '[data-concept="expected-risk"] > summary')
    browser('click', '--css', '[data-concept="expected-risk"] .technical > summary')
    snapshot('explain-expected-risk')
    click('button', 'Limpar')
    click('button', 'Preencher com dados de exemplo')
    fill('Usuários (Controle)', 50000)
    fill('Conversões (Controle)', 1000)
    fill('Usuários (Variante B)', 48500)
    fill('Conversões (Variante B)', 1000)
    browser('click', '--css', '[data-concept="srm"] > summary')
    browser('click', '--css', '[data-concept="srm"] .technical > summary')
    snapshot('explain-srm')

def sequential():
    example()
    click('switch', 'Teste em andamento')
    check(browser('attr', '--role', 'radio', '--name', 'Z test', '--exact', '--attr', 'aria-checked')['value'] == 'true', 'Sequential did not change method')
    check('O teste sequencial usa o Z test.' in browser('text', '--css', 'main')['text'], 'Method-change notice absent')
    snapshot('sequential')
    fill('Esta é a espiada nº', 5)
    check('Você já passou do número de espiadas planejadas.' in browser('text', '--css', 'main')['text'], 'Exceeded looks not rejected')
    fill('Esta é a espiada nº', 4)
    check('Análise final' in text(), text())
    check('Fronteira não cruzada' not in text('Alertas'), text('Alertas'))
    snapshot('sequential-final')

def revenue():
    example()
    browser('click', '--css', 'details.full-details > summary')
    fill('Valor por conversão', 100)
    result = text()
    check('41.142,86' in result and 'estimativa não confirmada' not in result, result)
    click('radio', '$')
    result = text()
    check('$' in result and '41.142,86' in result, result)
    snapshot('revenue-usd')
    browser('click', '--css', 'figure.chart-frame button')
    snapshot('interval-table')
    browser('click', '--css', 'figure.chart-frame:last-of-type button')
    snapshot('revenue-table')
    fill('Conversões (Variante B)', 1500)
    check('Perda estimada' in text(), text())
    snapshot('revenue-loss')
    browser('screenshot', '--path', str(ev / 'revenue-mobile.png'), '--full', '--viewport', '390x844')

def plan_update():
    click('button', 'Limpar')
    click('link', 'Pré-teste')
    fill('Tráfego semanal', 10000)
    fill('Conversões semanais', 300)
    browser('click', '--css', '[data-concept="mde-sample"] > summary')
    browser('click', '--css', '[data-concept="mde-sample"] .technical > summary')
    snapshot('explain-mde-sample')
    click('button', 'Escolher semana 3')
    click('button', 'Usar esse plano', '--wait-url', '/pt/analise', '--record', str(ev / 'plan-navigation.json'))
    requests = json.loads((ev / 'plan-navigation.json').read_text())
    check(not any(request['method'] == 'GET' and '/pt/analise' in request['url'] for request in requests), requests)
    check('15.000' in browser('text', '--css', 'main')['text'], 'Wrong selected-week plan')
    click('link', 'Pré-teste')
    fill('Tráfego semanal', 20000)
    click('link', 'Análise do teste')
    check('O pré-teste mudou' in browser('text', '--css', 'main')['text'], 'Plan changed notice absent')
    snapshot('plan-changed')
    click('button', 'Atualizar plano')
    check('O pré-teste mudou' not in browser('text', '--css', 'main')['text'], 'Plan not updated')
    snapshot('plan-updated')
    browser('screenshot', '--path', str(ev / 'plan-updated.png'), '--full', '--viewport', '1440x1000')

try:
    call('doctor')
    browser('start', '--lang', 'pt-BR')
    for name, fn in [('entries', entries), ('invalid', invalid), ('slots', slots), ('explanations', explanations), ('sequential', sequential), ('revenue', revenue), ('plan-update', plan_update)]: scenario(name, fn)
finally:
    (ev / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    log.close()
    print(subprocess.run([ctl, 'cleanup'], text=True, capture_output=True).stdout, flush=True)
if any(value != 'PASS' for value in results.values()): raise SystemExit(1)
