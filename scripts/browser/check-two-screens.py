"""Focused Chromium checks for the full-width map and blessing confirmation.

Generate two-screens-fixtures.ts first. This compares real public reducer saves,
without changing game HP, inventories, routes, or RNG to make a scenario pass.
Python Playwright and /usr/bin/chromium are verification environment tools.
"""
import json
import os
import re
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_TWO_SCREENS_URL', 'http://127.0.0.1:5295/spyier/')
DATA = json.loads(Path(os.environ.get('IWASON_TWO_SCREENS_FIXTURES', '/tmp/spyier-two-screens-fixtures.json')).read_text())
OUT = Path(os.environ.get('IWASON_TWO_SCREENS_OUTPUT', '/tmp/spyier-two-screens'))
ONLY = os.environ.get('IWASON_TWO_SCREENS_ONLY', '')
KEY = 'iwason-spire:run:v2'
SIZES = [(1920, 1080), (1366, 768), (390, 844)]
OUT.mkdir(parents=True, exist_ok=True)
RESULTS, FAILURES, ERRORS = [], [], []


def stored(page):
    return page.evaluate('(key)=>localStorage.getItem(key)', KEY)


def load(page, raw, speed='instant', reduced=True):
    page.mouse.move(0, 0)
    page.evaluate('''x=>{localStorage.clear();localStorage.setItem(x.key,x.raw);
      localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:x.speed,reducedMotion:x.reduced}));
    }''', {'key': KEY, 'raw': raw, 'speed': speed, 'reduced': reduced})
    page.reload(wait_until='networkidle')
    scene = json.loads(raw)['run']['screen']
    page.locator('.run-map-scroll' if scene == 'map' else '.blessing-screen').wait_for()
    assert stored(page) == raw, 'Loading changed the frozen save'


def exact_save(page, expected):
    page.wait_for_function('(x)=>localStorage.getItem(x.key)===x.expected', arg={'key': KEY, 'expected': expected})


def resource_basis(raw):
    state = json.loads(raw)['run']
    return {key: state.get(key) for key in ['hp', 'maxHp', 'gold', 'deck', 'relicIds', 'rngState', 'nextCardId']}


def graph_geometry(page):
    return page.evaluate('''()=>{let r=document.querySelector('.run-map-scroll').getBoundingClientRect(),
      g=document.querySelector('.run-map-graph').getBoundingClientRect();return {
      width:innerWidth,height:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
      map:[r.x,r.y,r.width,r.height],graph:[g.width,g.height],scroll:document.querySelector('.run-map-scroll').scrollTop};}''')


def map_case(page, case, width, height):
    load(page, case['save'])
    assert page.locator('.run-map-sidebar,.run-next-choice,.run-map-toolbar').count() == 0
    geometry = graph_geometry(page)
    assert geometry['sw'] <= width + 2 and geometry['sh'] <= height + 2, geometry
    assert geometry['map'][2] > width * .85 and geometry['map'][3] > height * .6, geometry
    assert page.locator('[data-node-id]').count() == len(case['nodes'])
    assert page.locator('[data-map-from]').count() == sum(len(node['connections']) for node in case['nodes'])
    assert page.locator('[data-map-state="available"]').count() == len(case['availableIds'])
    if case['currentNodeId']:
        assert page.locator('[data-map-state="current"]').count() == 1
        assert page.locator('[data-map-state="visited"]').count() == len(case['visited']) - 1
    page.screenshot(path=str(OUT / f'map-{case["name"]}-{width}.png'), full_page=True)

    # Zoom changes both axes and node size. It never changes the saved graph.
    sizes = []
    for label in ['縮小', '標準', '拡大']:
        page.locator('.run-map-zoom').get_by_role('button', name=label, exact=True).click()
        page.wait_for_timeout(100)
        assert page.locator('.run-map-zoom').get_by_role('button', name=label, exact=True).get_attribute('aria-pressed') == 'true'
        value = graph_geometry(page)
        sizes.append(value['graph'])
        assert stored(page) == case['save']
        assert value['sw'] <= width + 2 and value['sh'] <= height + 2, value
    assert sizes[0][0] < sizes[1][0] < sizes[2][0], sizes
    assert sizes[0][1] < sizes[1][1] < sizes[2][1], sizes
    page.locator('.run-map-zoom').get_by_role('button', name='標準', exact=True).click()

    # Non-selectable nodes remain inspectable for mouse, keyboard and touch.
    unavailable = next(node for node in reversed(case['nodes']) if node['id'] not in case['availableIds'])
    blocked = page.locator(f'[data-node-id="{unavailable["id"]}"]')
    assert blocked.get_attribute('aria-disabled') == 'true'
    blocked.scroll_into_view_if_needed()
    blocked.focus()
    page.keyboard.press('Enter')
    page.locator('.run-map-inspection').wait_for()
    assert f'第{unavailable["floor"]}フロア' in page.locator('.run-map-inspection').inner_text()
    assert stored(page) == case['save'], 'Inspecting an unavailable node moved the player'
    page.get_by_role('button', name='地点の詳細を閉じる').click()
    if width < 600:
        point = blocked.bounding_box()
        page.touchscreen.tap(point['x'] + point['width'] / 2, point['y'] + point['height'] / 2)
    else:
        blocked.hover()
    page.locator('.run-map-inspection').wait_for()
    assert stored(page) == case['save']
    if width < 600:
        page.get_by_role('button', name='地点の詳細を閉じる').click()
    else:
        page.mouse.move(0, 0)
        page.locator('.run-map-inspection').wait_for(state='hidden')
    page.locator('.run-map-scroll').evaluate('(n)=>n.scrollTop=0')
    assert graph_geometry(page)['scroll'] == 0
    page.get_by_role('button', name='現在地へ', exact=False).click()
    assert graph_geometry(page)['scroll'] > 0
    assert page.evaluate('scrollY') == 0
    page.locator(f'[data-node-id="{case["action"]["nodeId"]}"]').click()
    exact_save(page, case['result'])
    page.reload(wait_until='networkidle')
    assert stored(page) == case['result']


def open_option(page, case):
    page.locator(f'[data-blessing-option="{case["option"]["id"]}"]').get_by_role('button', name=re.compile('内容を確認')).click()
    page.get_by_role('dialog').wait_for()


def confirm_geometry(page, width, height):
    value = page.get_by_role('dialog').evaluate('''n=>{let r=n.getBoundingClientRect();return {
      x:r.x,y:r.y,right:r.right,bottom:r.bottom,sw:n.scrollWidth,cw:n.clientWidth,
      pageWidth:document.documentElement.scrollWidth,width:innerWidth};}''')
    assert value['x'] >= -1 and value['y'] >= -1 and value['right'] <= width + 1 and value['bottom'] <= height + 1, value
    assert value['sw'] <= value['cw'] + 2 and value['pageWidth'] <= width + 2, value
    assert page.locator('.ritual-altar-face,.ritual-altar-confirm .blessing-character').count() > 0
    assert page.locator('.ritual-confirm-modal,.ritual-altar-confirm').evaluate_all('''ns=>ns.every(n=>{
      const s=getComputedStyle(n);return ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].every(k=>parseFloat(s[k])===0)&&s.boxShadow==='none';})'''), 'Rectangular confirmation frames remain'
    face = page.locator('.ritual-altar-face').bounding_box()
    assert face and face['y'] >= 0 and face['y'] + face['height'] <= height, ('Initial stone face is not visible', face)


def blessing_case(page, case, width, height):
    load(page, case['offer'])
    open_option(page, case)
    exact_save(page, case['selected'])
    assert resource_basis(stored(page)) == resource_basis(case['offer'])
    confirm_geometry(page, width, height)
    # Capture the actual viewport: the underlying mobile offer page can be tall.
    page.screenshot(path=str(OUT / f'blessing-{case["name"]}-{width}.png'))
    for key in ['Tab', 'Tab', 'Tab', 'Shift+Tab']:
        page.keyboard.press(key)
        assert page.get_by_role('dialog').evaluate('(n)=>n.contains(document.activeElement)'), 'Focus escaped the confirmation'

    # Closing is local UI state. The selected option and eligible targets stay saved.
    page.keyboard.press('Escape')
    assert page.get_by_role('dialog').count() == 0
    assert stored(page) == case['selected']
    open_option(page, case)
    page.locator('.ritual-return-button').click()
    assert page.get_by_role('dialog').count() == 0
    assert stored(page) == case['selected']
    open_option(page, case)
    page.mouse.click(1, 1)
    assert page.get_by_role('dialog').count() == 0
    assert stored(page) == case['selected']
    open_option(page, case)
    page.get_by_role('dialog').get_by_role('button', name='閉じる', exact=True).click()
    assert page.get_by_role('dialog').count() == 0
    assert stored(page) == case['selected']
    open_option(page, case)

    if case['curseCards']:
        detail = page.locator('.blessing-curse-detail')
        detail.locator('summary').click()
        for curse in case['curseCards']:
            assert page.locator(f'.blessing-curse-detail [data-card-id="{curse["id"]}"]').count() == 1
            assert curse['description'] in detail.inner_text()
        assert stored(page) == case['selected']

    confirm = page.get_by_role('button', name='祝福を確定して受け取る', exact=False)
    if case['targets']:
        assert confirm.is_disabled()
        for index, target in enumerate(case['targets']):
            page.locator(f'[data-blessing-target="{target["uid"]}"]').get_by_role('button', name='このカードを対象にする', exact=False).click()
            exact_save(page, case['partial'][index])
            assert resource_basis(stored(page)) == resource_basis(case['offer'])
            if index == 0 and len(case['targets']) > 1:
                assert confirm.is_disabled()
                page.reload(wait_until='networkidle')
                page.get_by_role('dialog').wait_for()
                assert stored(page) == case['partial'][index]
    assert confirm.is_enabled()
    assert stored(page) == case['ready']
    # Both events run in the same JS task to exercise the synchronous click guard.
    confirm.evaluate('(n)=>{n.click();n.click();}')
    exact_save(page, case['result'])
    page.wait_for_selector('[data-blessing-stage="result"]')
    page.reload(wait_until='networkidle')
    assert stored(page) == case['result']
    page.get_by_role('button', name='祝福を胸に、塔を登る', exact=False).click()
    exact_save(page, case['continued'])


def motion_case(page, speed='normal', reduced=False, system_reduced=False):
    case = DATA['cases'][0]
    page.emulate_media(reduced_motion='reduce' if system_reduced else 'no-preference')
    load(page, case['ready'], speed=speed, reduced=reduced)
    page.get_by_role('dialog').wait_for()
    page.get_by_role('button', name='祝福を確定して受け取る', exact=False).click()
    exact_save(page, case['result'])
    flare = page.locator('.ritual-altar-flare')
    if reduced or speed == 'instant' or system_reduced:
        assert flare.count() == 0 or flare.evaluate_all('(ns)=>ns.every(n=>getComputedStyle(n).display==="none"||n.getAnimations({subtree:true}).every(a=>a.playState!=="running"))')
    else:
        flare.wait_for(state='attached')
        assert flare.evaluate('(n)=>n.getAnimations({subtree:true}).some(a=>a.playState==="running")')
    assert resource_basis(stored(page)) == resource_basis(case['result'])
    page.emulate_media(reduced_motion='no-preference')


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width, height in SIZES:
            context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width < 600, has_touch=width < 600)
            context.set_default_timeout(12000)
            page = context.new_page()
            page.on('pageerror', lambda error: ERRORS.append(str(error)))
            page.goto(URL, wait_until='networkidle')
            tests = []
            if ONLY != 'blessing':
                tests += [(f'map-{case["name"]}-{width}', lambda case=case: map_case(page, case, width, height)) for case in DATA['maps']]
            if ONLY != 'map':
                tests += [(f'blessing-{case["name"]}-{width}', lambda case=case: blessing_case(page, case, width, height)) for case in DATA['cases']]
                if width == 1366:
                    configs = [('normal', False, False), ('fast', False, False), ('normal', True, False), ('instant', False, False), ('normal', False, True)]
                    tests += [(f'blessing-motion-{speed}-{reduced}-{system}', lambda speed=speed, reduced=reduced, system=system: motion_case(page, speed, reduced, system)) for speed, reduced, system in configs]
            for name, check in tests:
                try:
                    check()
                    RESULTS.append(name)
                    print(json.dumps({'case': name, 'result': 'PASS'}), flush=True)
                except Exception as error:
                    FAILURES.append({'case': name, 'error': str(error), 'traceback': traceback.format_exc()})
                    page.screenshot(path=str(OUT / f'FAIL-{name}.png'), full_page=True)
                    print(json.dumps({'case': name, 'result': 'FAIL', 'error': str(error)}), flush=True)
            context.close()
        browser.close()
    result = {'passed': len(RESULTS), 'failed': len(FAILURES), 'results': RESULTS, 'failures': FAILURES, 'browserErrors': ERRORS}
    (OUT / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({'passed': len(RESULTS), 'failed': len(FAILURES), 'browserErrors': ERRORS}), flush=True)
    if FAILURES or ERRORS:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
