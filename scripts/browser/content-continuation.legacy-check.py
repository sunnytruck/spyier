"""Actual pre-update save restoration and boss reward continuation in Chromium.

Generate content-continuation.legacy-fixtures.ts, then run against production
preview with IWASON_CONTENT_URL (default http://127.0.0.1:5284/spyier/).
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_CONTENT_URL', 'http://127.0.0.1:5284/spyier/')
FIXTURES = json.loads(Path(os.environ.get('IWASON_CONTENT_LEGACY_FIXTURES', '/tmp/spyier-content-legacy-fixtures.json')).read_text())['fixtures']
OUT = Path(os.environ.get('IWASON_CONTENT_LEGACY_OUTPUT', '/tmp/spyier-content-legacy-browser'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'iwason-spire:run:v2'
results, errors = [], []


def saved(page):
    return page.evaluate('(k)=>localStorage.getItem(k)', KEY)


def layout(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'Horizontal page overflow'
    clipped = page.locator('.card-description,.blessing-offer p').evaluate_all('(ns)=>ns.filter(n=>n.clientHeight&&n.scrollHeight>n.clientHeight+2).map(n=>n.textContent)')
    assert not clipped, ('Clipped reward or blessing description', clipped)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for case in FIXTURES:
        context = browser.new_context(viewport={'width': case['width'], 'height': case['height']}, has_touch=case['width'] < 600, is_mobile=case['width'] < 600)
        context.set_default_timeout(10000)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        page.evaluate('''x=>{
          localStorage.clear(); localStorage.setItem(x.k,x.save);
          localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:'instant',reducedMotion:true,effectsQuality:'low'}));
        }''', {'k': KEY, 'save': case['save']})
        page.reload(wait_until='networkidle')
        page.wait_for_selector('.run-reward-cards .run-card-choice')
        assert saved(page) == case['save'], 'Loading changed the authentic old save'
        assert page.locator('.run-reward-cards .run-card-choice').count() == 3
        assert page.locator('.run-reward-cards [data-card-id="assassin_oppress"]').count() == 3
        assert json.loads(saved(page))['run']['reward']['cardIds'] == ['assassin_oppress'] * 3
        assert json.loads(saved(page))['run']['reward']['relicId'] is None
        original_count = len(json.loads(saved(page))['run']['deck'])
        original_relics = json.loads(saved(page))['run']['relicIds']
        layout(page)
        page.screenshot(path=str(OUT / f'{case["name"]}-reward.png'), full_page=True)
        for step in case['steps']:
            action = step['action']
            if action['type'] == 'takeCard':
                button = page.get_by_role('button', name='カードを受け取らずに進む', exact=False) if action['cardId'] is None else page.locator('.run-card-choice > button').first
                button.scroll_into_view_if_needed()
                # Real rapid double input must not grant the old repeated option twice.
                button.dblclick(delay=5)
                page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).run.screen==="victory"', arg=KEY)
                value = json.loads(saved(page))['run']
                assert len(value['deck']) == original_count + (0 if action['cardId'] is None else 1)
                assert value['relicIds'] == original_relics
                assert page.locator('.run-reward-cards').count() == 0
            else:
                button = page.get_by_role('button', name='Act 2へ進む · 次の祝福', exact=True)
                button.scroll_into_view_if_needed()
                button.tap() if case['width'] < 600 else button.click()
                page.wait_for_selector('.blessing-screen')
                assert page.locator('.blessing-offer').count() == 4
                value = json.loads(saved(page))['run']
                assert value['act'] == 2 and value['screen'] == 'blessing'
            assert saved(page) == step['save'], f'Legacy public action differs from engine: {action}'
            layout(page)
            page.reload(wait_until='networkidle')
            assert saved(page) == step['save'], 'Reload changed the committed legacy continuation'
        page.screenshot(path=str(OUT / f'{case["name"]}-act2.png'), full_page=True)
        results.append({'name': case['name'], 'width': case['width'], 'height': case['height'], 'sourceCommit': case['sourceCommit'], 'publicActions': len(case['steps']), 'result': 'PASS'})
        print(json.dumps(results[-1]), flush=True)
        context.close()
    browser.close()

assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'cases': results, 'browserErrors': errors}, ensure_ascii=False, indent=2))
print(json.dumps({'passed': len(results), 'browserErrors': errors}))
