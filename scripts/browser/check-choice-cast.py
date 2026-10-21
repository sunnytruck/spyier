"""Chromium regression checks for readable card choices and character casting.

Generate choice-cast-fixtures.ts first; use IWASON_CHOICE_URL/FIXTURES/OUTPUT
and optional IWASON_CHOICE_WIDTH or IWASON_CHOICE_ONLY to narrow a repeat.
Combat decks are controlled UI fixtures produced by the public combat factory.
Campaign selection states and expected saves use only public run actions.
"""
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_CHOICE_URL', 'http://127.0.0.1:5284/spyier/')
DATA = json.loads(Path(os.environ.get('IWASON_CHOICE_FIXTURES', '/tmp/spyier-choice-cast-fixtures.json')).read_text())
OUT = Path(os.environ.get('IWASON_CHOICE_OUTPUT', '/tmp/spyier-choice-cast-browser'))
ONLY = os.environ.get('IWASON_CHOICE_ONLY', '')
SIZES = [(1920, 1080), (1366, 768), (390, 844)]
KEY = 'iwason-spire:run:v2'
COMBAT = 'iwason-spire:save:v1'
RESULTS, FAILURES, ERRORS = [], [], []
OUT.mkdir(parents=True, exist_ok=True)


def saved(page, key=KEY):
    return page.evaluate('(key)=>localStorage.getItem(key)', key)


def exact_save(page, raw, key=KEY):
    page.wait_for_function('(x)=>localStorage.getItem(x.key)===x.raw', arg={'key': key, 'raw': raw})


def load(page, raw, key=KEY):
    page.mouse.move(0, 0)
    page.evaluate('''x=>{localStorage.clear();localStorage.setItem(x.key,x.raw);
      localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:'instant',reducedMotion:true,effectsQuality:'low'}));}''', {'key': key, 'raw': raw})
    page.reload(wait_until='networkidle')
    if key == COMBAT:
        page.locator('.practice-resume').click()
        page.locator('.pending-choice-grid').wait_for()
    exact_save(page, raw, key)


def click(locator, width):
    locator.scroll_into_view_if_needed()
    if width < 600:
        locator.tap()
    else:
        locator.click()


def card(page, uid, scope=''):
    return page.locator(f'{scope} .choice-card[data-card-uid="{uid}"]'.strip())


def layout(page, width, height, scope='.choice-card', full_height=False):
    geometry = page.evaluate('''()=>({width:innerWidth,height:innerHeight,
      sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})''')
    assert geometry['sw'] <= width + 2, geometry
    if full_height:
        assert geometry['sh'] <= height + 2, geometry
    bad = page.locator(f'{scope} .choice-card-description').evaluate_all('''ns=>ns.filter(n=>n.clientHeight&&
      (n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2||parseFloat(getComputedStyle(n).fontSize)<14||getComputedStyle(n).textOverflow==='ellipsis'))
      .map(n=>({text:n.textContent,w:n.clientWidth,sw:n.scrollWidth,h:n.clientHeight,sh:n.scrollHeight,font:getComputedStyle(n).fontSize}))''')
    assert not bad, ('Description clipped or too small', bad)
    if page.get_by_role('dialog').count():
        bounds = page.get_by_role('dialog').bounding_box()
        assert bounds and bounds['x'] >= -1 and bounds['y'] >= -1 and bounds['x'] + bounds['width'] <= width + 1 and bounds['y'] + bounds['height'] <= height + 1, bounds


def verify_card(locator, info, upgraded=False):
    actual = info['after' if upgraded else 'before']
    assert locator.get_attribute('data-upgraded') == str(actual['card']['upgraded']).lower()
    assert locator.locator('.choice-card-name').inner_text() == actual['name']
    assert locator.locator('.choice-card-description').inner_text() == actual['description']
    assert locator.locator('.choice-card-cost').inner_text() == str(actual['cost'])


def readonly_toggle(page, locator, info, key=KEY):
    before = saved(page, key)
    toggle = locator.locator('.choice-card-toggle')
    if not toggle.count():
        return
    picked = locator.locator('.choice-card-pick').get_attribute('aria-pressed') if locator.locator('.choice-card-pick').count() else None
    toggle.click()
    verify_card(locator, info, True)
    assert saved(page, key) == before, 'Upgrade preview mutated the save'
    if picked is not None:
        assert locator.locator('.choice-card-pick').get_attribute('aria-pressed') == picked, 'Preview toggle selected a card'
    toggle.click()
    verify_card(locator, info)
    assert saved(page, key) == before


def combat_case(page, case, width, height):
    load(page, case['save'], COMBAT)
    modal = page.get_by_role('dialog')
    confirm = page.locator('.pending-choice-confirm button')
    assert confirm.is_disabled()
    assert modal.get_by_role('button', name='閉じる', exact=True).count() == 0
    page.keyboard.press('Escape')
    page.mouse.click(1, 1)
    assert modal.count() == 1 and saved(page, COMBAT) == case['save'], 'Required combat choice was dismissed'
    for info in case['candidates']:
        item = card(page, info['uid'], '.pending-choice-grid')
        verify_card(item, info)
    toggle_info = next((info for info in case['candidates'] if not info['before']['card']['upgraded']), None)
    if toggle_info:
        readonly_toggle(page, card(page, toggle_info['uid'], '.pending-choice-grid'), toggle_info, COMBAT)
    layout(page, width, height)
    for index, uid in enumerate(case['selected']):
        target = card(page, uid, '.pending-choice-grid').locator('.choice-card-pick')
        click(target, width)
        assert target.get_attribute('aria-pressed') == 'true'
        assert saved(page, COMBAT) == case['save'], 'Selection applied before confirmation'
        assert confirm.is_enabled() == (index + 1 == case['amount'])
    blocked = next((info for info in case['candidates'] if info['uid'] not in case['selected']), None)
    if blocked:
        assert card(page, blocked['uid'], '.pending-choice-grid').locator('.choice-card-pick').is_disabled()
    # A selected full-card surface can be deselected and selected again at the cap.
    last = card(page, case['selected'][-1], '.pending-choice-grid').locator('.choice-card-pick')
    click(last, width)
    assert confirm.is_disabled()
    click(last, width)
    layout(page, width, height)
    page.screenshot(path=str(OUT / f'combat-{case["name"]}-{width}.png'))
    confirm.evaluate('(n)=>{n.click();n.click();}')
    exact_save(page, case['result'], COMBAT)
    assert page.locator('.pending-choice-grid').count() == 0
    page.reload(wait_until='networkidle')
    assert saved(page, COMBAT) == case['result']


def acquisition_case(page, case, width, height):
    load(page, case['save'])
    page.locator('[data-relic-acquisition-stage="select"]').wait_for()
    confirm = page.locator('.relic-acquisition-actions .primary-button')
    assert confirm.is_enabled() == (case['min'] == 0)
    page.keyboard.press('Escape')
    assert saved(page) == case['save']
    info = next((entry for entry in case['candidates'] if not entry['before']['card']['upgraded']), None)
    if info:
        readonly_toggle(page, card(page, info['uid'], '.relic-acquisition-card-grid'), info)
    layout(page, width, height)
    if case.get('optional'):
        confirm.evaluate('(n)=>{n.click();n.click();}')
        exact_save(page, case['optional'])
        page.reload(wait_until='networkidle')
        assert saved(page) == case['optional']
        load(page, case['save'])
    for uid in case['selected']:
        target = page.locator(f'[data-relic-target="{uid}"] .choice-card-pick')
        click(target, width)
        assert target.get_attribute('aria-pressed') == 'true'
        current = json.loads(saved(page))['run']
        assert current['deck'] == json.loads(case['save'])['run']['deck'], 'Selected card applied before confirmation'
    exact_save(page, case['ready'])
    page.reload(wait_until='networkidle')
    assert saved(page) == case['ready']
    assert page.locator('.relic-acquisition-card-grid .choice-card.is-selected').count() == len(case['selected'])
    layout(page, width, height)
    page.screenshot(path=str(OUT / f'{case["name"]}-{width}.png'), full_page=width < 600)
    confirm.evaluate('(n)=>{n.click();n.click();}')
    exact_save(page, case['result'])
    page.reload(wait_until='networkidle')
    assert saved(page) == case['result']
    assert page.locator('[data-relic-acquisition-stage="result"]').count() == 1
    layout(page, width, height)


def rest_case(page, case, width, height):
    load(page, case['save'])
    check = page.locator('.run-upgrade-list-toggle input')
    check.check()
    for info in case['candidates']:
        verify_card(card(page, info['uid'], '.run-upgrade-grid'), info, True)
    assert saved(page) == case['save']
    check.uncheck()
    uid = case['selected'][0]
    info = next(entry for entry in case['candidates'] if entry['uid'] == uid)
    click(card(page, uid, '.run-upgrade-grid').locator('.choice-card-pick'), width)
    modal = page.get_by_role('dialog')
    modal.wait_for()
    assert saved(page) == case['save']
    face = card(page, uid, '.card-upgrade-preview-face')
    verify_card(face, info)
    modal.locator('.card-upgrade-toggle').click()
    verify_card(face, info, True)
    assert saved(page) == case['save']
    layout(page, width, height)
    page.screenshot(path=str(OUT / f'rest-upgrade-{width}.png'))
    page.keyboard.press('Escape')
    assert modal.count() == 0 and saved(page) == case['save']
    click(card(page, uid, '.run-upgrade-grid').locator('.choice-card-pick'), width)
    page.get_by_role('button', name='強化を確定する', exact=False).evaluate('(n)=>{n.click();n.click();}')
    exact_save(page, case['result'])
    page.reload(wait_until='networkidle')
    assert saved(page) == case['result']


def shop_case(page, case, width, height):
    load(page, case['save'])
    open_remove = page.locator('.run-shop-item').filter(has_text='教えを、ひとつ手放す').get_by_role('button')
    click(open_remove, width)
    modal = page.get_by_role('dialog')
    modal.wait_for()
    info = next(entry for entry in case['candidates'] if entry['uid'] == case['selected'][0])
    readonly_toggle(page, card(page, info['uid'], '.run-deck-grid'), info)
    assert saved(page) == case['save']
    layout(page, width, height)
    page.keyboard.press('Escape')
    assert modal.count() == 0 and saved(page) == case['save']
    click(open_remove, width)
    click(card(page, info['uid'], '.run-deck-grid').locator('.choice-card-pick'), width)
    exact_save(page, case['result'])
    assert modal.count() == 0
    page.reload(wait_until='networkidle')
    assert saved(page) == case['result']


def class_case(page, case, width, height):
    page.evaluate('''()=>{localStorage.clear();localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:'instant',reducedMotion:true}));}''')
    page.reload(wait_until='networkidle')
    page.locator('.sanctum-seed-drawer summary').click()
    page.get_by_role('textbox', name='新しい探索のシード', exact=True).fill(case['seed'])
    page.locator('.title-start').click()
    page.locator('.class-selection-screen').wait_for()
    assert page.locator('.cast-profession').count() == 5
    for job in DATA['classes']:
        click(page.get_by_role('button', name=job['displayName'], exact=True), width)
        assert page.locator('.class-selection-screen').get_attribute('data-class-id') == job['id']
        assert page.locator('[data-selected-character]').get_attribute('data-selected-character') == job['id']
        assert page.locator('.cast-profession[aria-pressed="true"]').count() == 1
        assert page.locator('.cast-name h2').inner_text() == job['displayName']
        assert page.locator('.cast-starting-health b').inner_text() == str(job['maxHp'])
        assert job['relic']['name'] in page.locator('.cast-relic').inner_text()
        assert job['relic']['description'] in page.locator('.cast-relic').inner_text()
        assert saved(page) is None, 'Class inspection created a run'
        layout(page, width, height, full_height=width >= 600)
        if width >= 600:
            start = page.locator('.cast-start').bounding_box()
            assert start and start['y'] >= 0 and start['y'] + start['height'] <= height, start
    click(page.get_by_role('button', name=case['displayName'], exact=True), width)
    page.screenshot(path=str(OUT / f'class-{case["id"]}-{width}.png'), full_page=width < 600)
    click(page.locator('.cast-deck-details'), width)
    modal = page.get_by_role('dialog')
    modal.wait_for()
    assert page.locator('.cast-starter-entry').count() == len(case['cards'])
    for info in case['cards']:
        item = card(page, info['uid'], '.cast-starter-list')
        verify_card(item, info)
        assert str(info['count']) in item.locator('..').locator('.cast-starter-count').inner_text()
    toggle_info = next((entry for entry in case['cards'] if not entry['before']['card']['upgraded']), None)
    if toggle_info:
        readonly_toggle(page, card(page, toggle_info['uid'], '.cast-starter-list'), toggle_info)
    assert saved(page) is None
    layout(page, width, height)
    if case['id'] in ['oracle', 'machinist']:
        page.screenshot(path=str(OUT / f'class-deck-{case["id"]}-{width}.png'))
    page.keyboard.press('Escape')
    assert modal.count() == 0
    click(page.locator('.cast-start'), width)
    page.locator('.blessing-screen').wait_for()
    exact_save(page, case['expected'])
    assert page.locator('.blessing-offer').count() == 4
    page.reload(wait_until='networkidle')
    assert saved(page) == case['expected']


def record(name, width, height, task, page):
    if ONLY and ONLY not in name:
        return
    try:
        print(f'BEGIN {width} {name}', flush=True)
        task()
        RESULTS.append({'case': name, 'width': width, 'height': height, 'PASS': True})
        print(json.dumps(RESULTS[-1]), flush=True)
    except Exception as error:
        FAILURES.append({'case': name, 'width': width, 'error': str(error), 'trace': traceback.format_exc()})
        page.screenshot(path=str(OUT / f'FAIL-{name}-{width}.png'), full_page=True)
        print(json.dumps(FAILURES[-1]), flush=True)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in SIZES:
        if os.environ.get('IWASON_CHOICE_WIDTH') and width != int(os.environ['IWASON_CHOICE_WIDTH']):
            continue
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width < 600, has_touch=width < 600)
        context.set_default_timeout(12000)
        page = context.new_page()
        page.on('pageerror', lambda error: ERRORS.append(str(error)))
        page.goto(URL, wait_until='networkidle')
        for case in DATA['combat']:
            record(case['name'], width, height, lambda c=case: combat_case(page, c, width, height), page)
        for case in DATA['run']:
            fn = rest_case if case['name'] == 'rest-upgrade' else shop_case if case['name'] == 'shop-remove' else acquisition_case
            record(case['name'], width, height, lambda c=case, f=fn: f(page, c, width, height), page)
        for case in DATA['classes']:
            record('class-' + case['id'], width, height, lambda c=case: class_case(page, c, width, height), page)
        context.close()
    browser.close()
summary = {'PASS': len(RESULTS), 'FAIL': len(FAILURES), 'cases': RESULTS, 'failures': FAILURES, 'pageErrors': ERRORS}
(OUT / 'results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
print(json.dumps({'PASS': len(RESULTS), 'FAIL': len(FAILURES), 'pageErrors': ERRORS}), flush=True)
assert not FAILURES and not ERRORS
