"""Real Chromium regressions for disabled cards and the 50-card hand limit.

Generate scripts/browser/compact-battle-fixtures.ts first, start Vite, then run:
COMPACT_BATTLE_URL=http://127.0.0.1:5282/spyier/ python scripts/browser/check-hand-details.py
Requires Python Playwright and /usr/bin/chromium. Uses isolated browser contexts.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('COMPACT_BATTLE_URL', 'http://127.0.0.1:5282/spyier/')
FIXTURES = json.loads(Path(os.environ.get('COMPACT_BATTLE_FIXTURES', '/tmp/spyier-compact-fixtures.json')).read_text())['detailFixtures']
KEY = 'iwason-spire:run:v2'
errors = []
checks = []


def load(page, saved):
    # compact-battle-fixtures.ts has already round-tripped every stress save
    # through the actual validator; loading must preserve its exact bytes.
    page.evaluate('''x => {
      localStorage.clear(); localStorage.setItem(x.key, x.saved);
      localStorage.setItem('iwason-spire:settings:v1', JSON.stringify({ speed:'instant', reducedMotion:true, effectsQuality:'low' }));
    }''', {'key': KEY, 'saved': saved})
    page.reload(wait_until='networkidle')
    page.wait_for_selector('.compact-battle')
    assert page.evaluate('k => localStorage.getItem(k)', KEY) == saved
    return saved


def check_detail(page, width, height, expected):
    panel = page.locator('.battle-card-inspector.is-pinned')
    panel.wait_for()
    rect = panel.bounding_box()
    assert rect['x'] >= 0 and rect['y'] >= 0
    assert rect['x'] + rect['width'] <= width and rect['y'] + rect['height'] <= height, rect
    assert page.locator('.battle-card-inspector .card-description').evaluate('n => n.clientHeight >= n.scrollHeight - 2')
    assert page.evaluate('scrollY') == 0
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.evaluate('k => localStorage.getItem(k)', KEY) == expected, 'A preview must never play or modify a card'


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(1920, 1080), (1366, 768), (390, 844)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 600, is_mobile=width < 600)
        context.set_default_timeout(8000)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(f'console.error: {message.text}') if message.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        expected = load(page, next(fixture['save'] for fixture in FIXTURES if fixture['name'] == '50-card-last-detail'))
        assert page.locator('.battle-hand-slot').count() == 50
        page.locator('.battle-hand-cards').evaluate('n => { n.scrollLeft = n.scrollWidth; }')
        page.wait_for_timeout(100)
        detail = page.locator('.battle-card-detail-button').last
        detail.tap() if width < 600 else detail.click()
        check_detail(page, width, height, expected)
        checks.append({'width': width, 'case': '50-card-last-detail'})
        if width != 1920:
            expected = load(page, next(fixture['save'] for fixture in FIXTURES if fixture['name'] == 'disabled-card-details-no-play'))
            card = page.locator('.battle-hand-slot > .game-card').first
            assert card.is_disabled()
            # Native disabled buttons do not click; touch details use pointerup.
            card.tap(force=True) if width < 600 else page.locator('.battle-card-detail-button').first.click()
            check_detail(page, width, height, expected)
            assert page.locator('.battle-card-inspector-actions > button').is_disabled()
            page.get_by_role('button', name='カード詳細を閉じる').click()
            page.get_by_role('button', name='次の手札を表示').click()
            page.wait_for_timeout(100)
            assert page.locator('.battle-hand-cards').evaluate('n => n.scrollLeft') > 0
            assert page.evaluate('scrollY') == 0
            checks.append({'width': width, 'case': 'disabled-card-details-no-play'})
        context.close()
    browser.close()
assert not errors, errors
print(json.dumps({'passed': len(checks), 'checks': checks, 'browserErrors': errors}, ensure_ascii=False))
