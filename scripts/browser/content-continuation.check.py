"""Production Chromium checks for the additional cards/relics (isolated saves).

Generate content-continuation.fixtures.ts, build, start Vite preview, then run:
IWASON_CONTENT_URL=http://127.0.0.1:5284/spyier/ python scripts/browser/content-continuation.check.py
Requires the environment's Python Playwright and /usr/bin/chromium. No package
changes, app hooks, or production saves are used. Fixture resource arrangements
test UI and exact public actions, not acquisition rates or campaign balance.
"""
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_CONTENT_URL', 'http://127.0.0.1:5284/spyier/')
DATA = json.loads(Path(os.environ.get('IWASON_CONTENT_FIXTURES', '/tmp/spyier-content-fixtures.json')).read_text())
OUT = Path(os.environ.get('IWASON_CONTENT_OUTPUT', '/tmp/spyier-content-browser'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'iwason-spire:run:v2'
RESULTS, FAILURES, ERRORS = [], [], []
SIZES = [(1920, 1080), (1366, 768), (390, 844)]


def saved(page):
    return page.evaluate('(key) => localStorage.getItem(key)', KEY)


def idle(page):
    page.wait_for_selector('.battle-screen[data-presentation-busy="false"]')


def load(page, case):
    page.evaluate('''x => {
        localStorage.clear(); localStorage.setItem(x.key, x.save);
        localStorage.setItem('iwason-spire:settings:v1', JSON.stringify({speed:'instant', reducedMotion:true, effectsQuality:'low'}));
    }''', {'key': KEY, 'save': case['save']})
    page.reload(wait_until='networkidle')
    idle(page)
    assert saved(page) == case['save'], 'Restoration changed the frozen valid save'


def layout(page):
    value = page.evaluate('''() => {
      const selectors = ['.battle-arena','.battle-hand','.energy','.end-turn-button','.enemy-intent','.class-resource-readout','.hud-relics','.hud-potions'];
      const rect = n => { const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}; };
      return {width:innerWidth,height:innerHeight,scrollY,scrollHeight:document.documentElement.scrollHeight,
        scrollWidth:document.documentElement.scrollWidth,nodes:Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].map(rect)]))};
    }''')
    assert value['scrollY'] == 0, value
    assert value['scrollWidth'] <= value['width'] + 2, value
    assert value['scrollHeight'] <= value['height'] + 2, value
    for selector, nodes in value['nodes'].items():
        assert nodes, f'Missing {selector}'
        for node in nodes:
            assert node['w'] > 5 and node['h'] > 5, (selector, node)
            assert node['x'] >= -1 and node['y'] >= -1 and node['right'] <= value['width'] + 1 and node['bottom'] <= value['height'] + 1, (selector, node)
    return value


def no_clipped_text(locator):
    clips = locator.locator('.card-description').evaluate_all('(nodes)=>nodes.filter(n=>n.scrollHeight>n.clientHeight+2).map(n=>n.textContent)')
    assert not clips, ('Clipped card effects', clips)


def check_hud(page, run):
    state, job = run['combat'], run['classId']
    assert page.locator(f'[data-player-class="{job}"]').count() == 1
    assert page.locator(f'.combatant--player [data-character-class="{job}"]').count() == 1
    if job == 'machinist':
        orbs = state['classResources']['orbs']
        slots = page.locator('.class-orb-slot').evaluate_all('(ns)=>ns.map(n=>({orb:n.dataset.orbType,next:n.dataset.nextEvoke==="true"}))')
        expected = [{'orb': orbs[i] if i < len(orbs) else 'empty', 'next': i == len(orbs)-1} for i in range(3 + state.get('orbSlotBonus', 0))]
        assert slots == expected, (slots, expected)
    if job == 'necromancer':
        assert page.locator('.osty-unit-hp b').inner_text() == str(state['classResources']['ostyHp'])
    if job == 'oracle':
        assert page.locator('.star-energy-gem b').inner_text() == str(state['classResources']['stars'])
        assert page.locator('[data-resource-hud="forge"] b').inner_text() == str(state['classResources']['forge'])


def check_previews_and_relics(page, case):
    before = saved(page)
    page.get_by_role('button', name='デッキを確認', exact=False).click()
    modal = page.locator('.modal')
    normal = modal.locator(f'.inspect-card[data-card-id="{case["primaryCardId"]}"][data-upgraded="false"]').first
    normal.scroll_into_view_if_needed()
    assert normal.locator('h3').inner_text() == case['normal']['name']
    assert normal.locator('.card-description').inner_text() == case['normal']['description']
    assert normal.locator('.card-cost').inner_text() == str(case['normal']['cost'])
    no_clipped_text(normal)
    normal.get_by_role('button', name='強化後を表示', exact=False).click()
    preview = modal.locator(f'.inspect-card.is-upgrade-preview[data-card-id="{case["primaryCardId"]}"]')
    assert preview.locator('h3').inner_text() == case['upgraded']['name']
    assert preview.locator('.card-description').inner_text() == case['upgraded']['description']
    assert preview.locator('.card-cost').inner_text() == str(case['upgraded']['cost'])
    assert preview.locator('.card-upgrade-change').count() > 0
    no_clipped_text(preview)
    # A genuinely upgraded duplicate is displayed independently of the preview.
    upgraded = modal.locator(f'.inspect-card[data-card-id="{case["primaryCardId"]}"][data-upgraded="true"]:not(.is-upgrade-preview)')
    assert upgraded.count() == 1
    assert upgraded.locator('.card-description').inner_text() == case['upgraded']['description']
    no_clipped_text(upgraded)
    assert saved(page) == before, 'Inspecting upgrades mutated the real deck'
    modal.get_by_role('button', name='閉じる', exact=True).click()
    # Native hover title + click/tap details are both backed by actual relic data.
    for relic in case['relics']:
        assert page.locator(f'.hud-relics [data-relic-id="{relic["id"]}"]').count() == 1
        assert page.locator('.hud-relic-token').filter(has=page.locator(f'[data-relic-id="{relic["id"]}"]')).get_attribute('title') == f'{relic["name"]}：{relic["description"]}'
    page.locator('.hud-relics').click()
    modal = page.locator('.modal')
    for relic in case['relics']:
        article = modal.locator('article').filter(has=page.locator(f'[data-relic-id="{relic["id"]}"]'))
        assert article.locator('h3').inner_text() == relic['name']
        assert article.locator('p').inner_text() == relic['description']
    assert saved(page) == before, 'Relic inspection mutated combat'
    modal.get_by_role('button', name='閉じる', exact=True).click()


def play_card(page, uid, mobile):
    slot = page.locator('.battle-hand-slot').filter(has=page.locator(f'[data-card-uid="{uid}"]'))
    slot.scroll_into_view_if_needed()
    if mobile:
        slot.locator('.battle-card-detail-button').tap()
        inspector = page.locator('.battle-card-inspector.is-pinned')
        inspector.wait_for()
        rect = inspector.bounding_box()
        viewport = page.viewport_size
        assert rect['x'] >= 0 and rect['y'] >= 0 and rect['x'] + rect['width'] <= viewport['width'] + 1 and rect['y'] + rect['height'] <= viewport['height'] + 1, rect
        no_clipped_text(inspector)
        inspector.get_by_role('button', name='このカードを使用', exact=True).tap()
    else:
        slot.locator(f'[data-card-uid="{uid}"]').click()
    idle(page)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in SIZES:
        context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 600, is_mobile=width < 600)
        context.set_default_timeout(10000)
        page = context.new_page()
        page.on('pageerror', lambda error: ERRORS.append(str(error)))
        page.on('console', lambda message: ERRORS.append(message.text) if message.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        for case in [*DATA['fixtures'], *DATA.get('stressFixtures', [])]:
            name = f'{case["name"]}-{width}x{height}'
            try:
                load(page, case)
                before_geometry = layout(page)
                check_hud(page, json.loads(case['save'])['run'])
                if case.get('mode') == 'orbs':
                    slots = page.locator('.class-orb-slots--extended')
                    assert slots.count() == 1
                    assert slots.get_attribute('data-orb-capacity') == str(case['capacity'])
                    if case['capacity'] == 27:
                        assert slots.evaluate('(n)=>n.scrollWidth>n.clientWidth')
                    assert page.locator('.class-orb-slot[data-next-evoke="true"]').get_attribute('data-orb-index') == str(case['capacity'] - 1)
                    slots.evaluate('(n)=>n.scrollLeft=0')
                    page.locator('.class-orb-slot').first.click()
                    assert page.locator('.class-resource-modal h2').inner_text().startswith('スロット1 ·')
                    page.locator('.class-resource-modal').get_by_role('button', name='閉じる', exact=True).click()
                    slots.evaluate('(n)=>n.scrollLeft=n.scrollWidth')
                    page.locator('.class-orb-slot').last.wait_for(state='visible')
                    last = page.locator('.class-orb-slot').last.bounding_box()
                    assert last['x'] >= 0 and last['x'] + last['width'] <= width + 1, last
                    page.locator('.class-orb-slot').last.click()
                    assert page.locator('.class-resource-modal h2').inner_text().startswith(f'スロット{case["capacity"]} ·')
                    page.locator('.class-resource-modal').get_by_role('button', name='閉じる', exact=True).click()
                    strip_rect = slots.bounding_box()
                    character = page.locator('.combatant--player .actor-motion > .character-art').bounding_box()
                    assert character['y'] >= strip_rect['y'] + strip_rect['height'] - 2, ('Orb strip overlaps the character', strip_rect, character)
                    assert saved(page) == case['save'], 'Orb browsing changed combat'
                    layout(page)
                    actions = 0
                else:
                    check_previews_and_relics(page, case)
                    for step in case['steps']:
                        if step['action']['type'] == 'playCard':
                            play_card(page, step['action']['cardId'], width < 600)
                        else:
                            page.locator('.end-turn-button').click()
                            idle(page)
                        assert saved(page) == step['save'], f'Browser action differs from engine: {step["action"]}'
                        check_hud(page, json.loads(step['save'])['run'])
                        layout(page)
                    final = saved(page)
                    page.reload(wait_until='networkidle')
                    idle(page)
                    assert saved(page) == final, 'Reload altered final resources/counters'
                    actions = len(case['steps'])
                page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)
                RESULTS.append({'name': name, 'result': 'PASS', 'publicActions': actions, 'geometry': before_geometry})
                print(json.dumps({'name': name, 'result': 'PASS', 'publicActions': actions}), flush=True)
            except Exception as error:
                FAILURES.append({'name': name, 'error': str(error), 'traceback': traceback.format_exc()})
                page.screenshot(path=str(OUT / f'FAIL-{name}.png'), full_page=True)
                print(json.dumps({'name': name, 'result': 'FAIL', 'error': str(error)}), flush=True)
        context.close()
    browser.close()

summary = {'passed': len(RESULTS), 'failed': len(FAILURES), 'browserErrors': ERRORS, 'results': RESULTS, 'failures': FAILURES}
(OUT / 'results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
assert not FAILURES and not ERRORS, json.dumps({'failed': FAILURES, 'browserErrors': ERRORS}, ensure_ascii=False)
print(json.dumps({'passed': len(RESULTS), 'failed': 0, 'publicActions': sum(item['publicActions'] for item in RESULTS), 'browserErrors': []}))
