"""Chromium visual and public-action checks for the original IWASON art direction.

Generate art-direction-fixtures.ts first. IWASON_ART_URL selects Vite preview;
IWASON_ART_BASELINE=1 captures the untouched build without new-layout assertions.
Python Playwright + /usr/bin/chromium are environment tools, not app dependencies.
"""
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_ART_URL', 'http://127.0.0.1:5284/spyier/')
DATA = json.loads(Path(os.environ.get('IWASON_ART_FIXTURES', '/tmp/spyier-art-fixtures.json')).read_text())
BASELINE = os.environ.get('IWASON_ART_BASELINE') == '1'
LAYOUT_ONLY = os.environ.get('IWASON_ART_LAYOUT_ONLY') == '1'
OUT = Path(os.environ.get('IWASON_ART_OUTPUT', '/tmp/spyier-art-baseline' if BASELINE else '/tmp/spyier-art-browser'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'iwason-spire:run:v2'
SIZES = [(1920, 1080), (1366, 768), (390, 844)]
if os.environ.get('QA_WIDTH'):
    SIZES = [size for size in SIZES if size[0] == int(os.environ['QA_WIDTH'])]
ERRORS, RESULTS, FAILURES = [], [], []


def stored(page):
    return page.evaluate('(key)=>localStorage.getItem(key)', KEY)


def load(page, raw=None, speed='instant', reduced=True):
    page.evaluate('''x=>{
      localStorage.clear();if(x.save)localStorage.setItem(x.key,x.save);
      localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:x.speed,reducedMotion:x.reduced,effectsQuality:'full'}));
    }''', {'key': KEY, 'save': raw, 'speed': speed, 'reduced': reduced})
    page.reload(wait_until='networkidle')
    if raw:
        state = json.loads(raw)['run']
        page.wait_for_selector('.battle-screen' if state['screen'] == 'combat' else '.blessing-screen' if state['screen'] == 'blessing' else '.run-map-screen')
        if state['screen'] == 'combat':
            idle(page)
        assert stored(page) == raw, 'Restoration changed the frozen source state'
    else:
        page.wait_for_selector('.title-screen')


def idle(page):
    page.wait_for_selector('.battle-screen[data-presentation-busy="false"]', timeout=15000)


def geometry(page):
    return page.evaluate('''()=>{
      const selectors=['.topbar','.title-screen','.title-art','.title-start','.blessing-screen','.blessing-offer','.blessing-character',
        '.run-map-screen','.run-map-panel','.run-map-scroll','.battle-arena','.battle-hand','.battle-hand-cards','.energy',
        '.end-turn-button','.enemy-intent','.health-info','.class-resource-readout','.hud-potions','.hud-relics','.character-stage'];
      const rect=n=>{const r=n.getBoundingClientRect();const x=Math.max(1,Math.min(innerWidth-1,r.x+r.width/2));
        const y=Math.max(1,Math.min(innerHeight-1,r.y+r.height/2));const hit=document.elementFromPoint(x,y);
        return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,
          exposed:!!hit&&(n.contains(hit)||hit.contains(n)),text:n.textContent?.trim().slice(0,90)};};
      return {width:innerWidth,height:innerHeight,scrollY,scrollHeight:document.documentElement.scrollHeight,
        scrollWidth:document.documentElement.scrollWidth,nodes:Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].map(rect)]))};
    }''')


def check_viewport(page, scene):
    value = geometry(page)
    assert value['scrollWidth'] <= value['width'] + 2, ('Horizontal page overflow', value)
    if scene == 'combat' or value['width'] >= 1000:
        assert value['scrollHeight'] <= value['height'] + 2, ('Vertical page overflow', value)
        assert value['scrollY'] == 0, ('Page moved', value)
    required = {
        'title': ['.title-start'], 'blessing': ['.blessing-offer'],
        'map': ['.run-map-scroll'],
        'combat': ['.battle-arena', '.battle-hand', '.energy', '.end-turn-button', '.enemy-intent', '.health-info', '.class-resource-readout'],
    }[scene]
    for selector in required:
        nodes = value['nodes'][selector]
        assert nodes, f'Missing {selector}'
        for node in nodes:
            assert node['w'] > 5 and node['h'] > 5, ('Invisible control', selector, node)
            if scene == 'combat' or value['width'] >= 1000:
                assert node['x'] >= -1 and node['y'] >= -1 and node['right'] <= value['width'] + 1 and node['bottom'] <= value['height'] + 1, ('Offscreen control', selector, node)
    if scene == 'blessing':
        # A negative inherited top on the mobile copy previously clipped the
        # speaker's name/dialogue even though the outer stage passed geometry.
        clipped = page.locator('.blessing-character-copy h2,.blessing-character-copy blockquote').evaluate_all('''ns=>ns.filter(n=>{
          const r=n.getBoundingClientRect();let p=n.parentElement;
          while(p){const s=getComputedStyle(p);if(/hidden|clip/.test(s.overflow+s.overflowY)){
            const b=p.getBoundingClientRect();if(r.top<b.top-1||r.bottom>b.bottom+1||r.left<b.left-1||r.right>b.right+1)return true;
          }p=p.parentElement;}return false;
        }).map(n=>n.textContent)''')
        assert not clipped, ('Ritual dialogue clipped by its stage', clipped)
    return value


def check_resources(page, run):
    state, job = run['combat'], run['classId']
    assert page.locator(f'[data-player-class="{job}"]').count() == 1
    assert page.locator(f'.combatant--player [data-character-class="{job}"]').count() == 1
    resource = state['classResources']
    if job == 'machinist':
        actual = page.locator('.class-orb-slot').evaluate_all('(ns)=>ns.map(n=>({orb:n.dataset.orbType,next:n.dataset.nextEvoke==="true"}))')
        expected = [{'orb': resource['orbs'][i] if i < len(resource['orbs']) else 'empty', 'next': i == len(resource['orbs'])-1} for i in range(3 + state.get('orbSlotBonus', 0))]
        assert actual == expected, (actual, expected)
    if job == 'necromancer':
        assert page.locator('.osty-unit-hp b').inner_text() == str(resource['ostyHp'])
    if job == 'oracle':
        assert page.locator('.star-energy-gem b').inner_text() == str(resource['stars'])
        assert page.locator('[data-resource-hud="forge"] b').inner_text() == str(resource['forge'])


def check_detail(page):
    panel = page.locator('.battle-card-inspector')
    panel.wait_for(state='visible')
    box = panel.bounding_box()
    viewport = page.viewport_size
    assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= viewport['width'] + 1 and box['y'] + box['height'] <= viewport['height'] + 1, box
    assert not panel.locator('.card-description,.card-runtime').evaluate_all('(ns)=>ns.filter(n=>n.scrollHeight>n.clientHeight+2).map(n=>n.textContent)'), 'Card detail cuts off text'


def play_card(page, uid, mobile):
    slot = page.locator('.battle-hand-slot').filter(has=page.locator(f'[data-card-uid="{uid}"]'))
    slot.scroll_into_view_if_needed()
    if mobile:
        before = stored(page)
        slot.locator('.battle-card-detail-button').tap()
        check_detail(page)
        assert stored(page) == before, 'Inspecting the card played it'
        page.locator('.battle-card-inspector').get_by_role('button', name='このカードを使用', exact=True).tap()
    else:
        slot.locator(f'[data-card-uid="{uid}"]').click()
    idle(page)


def inspect_upgrades(page, case):
    before = stored(page)
    page.get_by_role('button', name='デッキを確認', exact=False).click()
    modal = page.locator('.modal')
    spec = case['preview']
    normal = modal.locator(f'.inspect-card[data-card-id="{spec["cardId"]}"][data-upgraded="false"]').first
    normal.scroll_into_view_if_needed()
    assert normal.locator('h3').inner_text() == spec['before']['name']
    assert normal.locator('.card-description').inner_text() == spec['before']['description']
    assert normal.locator('.card-cost').inner_text() == str(spec['before']['cost'])
    normal.get_by_role('button', name='強化後を表示', exact=False).click()
    preview = modal.locator(f'.inspect-card.is-upgrade-preview[data-card-id="{spec["cardId"]}"]')
    assert preview.locator('h3').inner_text() == spec['after']['name']
    assert preview.locator('.card-description').inner_text() == spec['after']['description']
    assert preview.locator('.card-cost').inner_text() == str(spec['after']['cost'])
    assert preview.locator('.card-upgrade-change').count() > 0
    actual_upgraded = modal.locator(f'.inspect-card[data-card-id="{spec["upgradedId"]}"][data-upgraded="true"]:not(.is-upgrade-preview)').first
    actual_upgraded.scroll_into_view_if_needed()
    assert actual_upgraded.locator('h3').inner_text() == spec['upgraded']['name']
    assert actual_upgraded.locator('.card-description').inner_text() == spec['upgraded']['description']
    assert not modal.locator('.card-description').evaluate_all('(ns)=>ns.filter(n=>n.scrollHeight>n.clientHeight+2).map(n=>n.textContent)'), 'Deck card effect text is cut off'
    assert stored(page) == before, 'Previewing an upgrade changed the real deck'
    modal.get_by_role('button', name='閉じる', exact=True).click()


def capture(page, name, scene, raw, width, height):
    load(page, raw)
    value = geometry(page) if BASELINE else check_viewport(page, scene)
    if scene == 'combat':
        check_resources(page, json.loads(raw)['run'])
    page.screenshot(path=str(OUT / f'{name}-{width}x{height}.png'))
    return value


def stress_details(page, case, width):
    before = stored(page)
    if case.get('mode') == 'statuses':
        assert page.locator('.combatant--player .status-chip').count() >= 7
        for chip in page.locator('.combatant--player .status-chip').all():
            box = chip.bounding_box()
            assert box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= width + 1
        assert stored(page) == before
    elif case.get('capacity'):
        strip = page.locator('.class-orb-slots--extended')
        assert strip.count() == 1
        assert page.locator('[data-next-evoke="true"]').get_attribute('data-orb-index') == str(case['capacity'] - 1)
        for last in [False, True]:
            strip.evaluate('(n,last)=>n.scrollLeft=last?n.scrollWidth:0', last)
            slot = page.locator('.class-orb-slot').last if last else page.locator('.class-orb-slot').first
            slot.click()
            assert page.locator('.class-resource-modal').is_visible()
            page.locator('.class-resource-modal').get_by_role('button', name='閉じる', exact=True).click()
        assert stored(page) == before
    else:
        assert page.locator('.battle-hand-slot').count() == 50
        hand = page.locator('.battle-hand-cards')
        hand.evaluate('(n)=>n.scrollLeft=n.scrollWidth')
        final = page.locator('.battle-hand-slot').last
        final.locator('.battle-card-detail-button').click()
        check_detail(page)
        assert stored(page) == before
        page.get_by_role('button', name='カード詳細を閉じる', exact=True).click()
        assert page.evaluate('scrollY') == 0


def drag(page, context, uid, target, valid, mobile):
    page.keyboard.press('Escape')
    source = page.locator(f'.battle-hand [data-card-uid="{uid}"]')
    source.scroll_into_view_if_needed()
    page.mouse.move(0, 0)
    box, destination = source.bounding_box(), target.bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    tx, ty = destination['x'] + destination['width'] / 2, destination['y'] + destination['height'] / 2
    if mobile:
        session = context.new_cdp_session(page)
        def touch(kind, x=None, y=None):
            session.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if x is None else [{'x': x, 'y': y}]})
        touch('touchStart', x, y)
        for step in range(1, 5):
            touch('touchMove', x, y - step * 8)
        for step in range(1, 11):
            touch('touchMove', x + (tx-x)*step/10, y-32 + (ty-y+32)*step/10)
    else:
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(tx, ty, steps=15)
    page.wait_for_selector('.battle-card-ghost')
    page.wait_for_function('(valid)=>document.querySelector(".card-drag-overlay")?.dataset.valid===String(valid)', arg=valid)
    if mobile:
        touch('touchEnd'); session.detach()
    else:
        page.mouse.up()
    idle(page)
    assert page.evaluate('scrollY') == 0, 'Card dragging moved the page'


def interaction_checks(page, context, width):
    case = next(case for case in DATA['fixtures'] if case['name'] == 'berserker-triple')
    load(page, case['save'])
    before = stored(page)
    player = page.locator('.combatant--player .character-stage')
    drag(page, context, 'art-3', player, False, width < 600)
    assert stored(page) == before, 'Invalid card drop consumed resources'
    drag(page, context, 'art-1', player, True, width < 600)
    state = json.loads(stored(page))['run']['combat']
    assert state['stats']['cardsPlayed'] == json.loads(before)['run']['combat']['stats']['cardsPlayed'] + 1
    before = state
    target = page.locator('[data-enemy-id]').nth(1)
    target_id = target.get_attribute('data-enemy-id')
    drag(page, context, 'art-3', target, True, width < 600)
    state = json.loads(stored(page))['run']['combat']
    assert state['selectedEnemyId'] == target_id and state['enemies'][1]['hp'] < before['enemies'][1]['hp']
    assert state['enemies'][0]['hp'] == before['enemies'][0]['hp'] and state['enemies'][2]['hp'] == before['enemies'][2]['hp']
    # Double input while presentation is active must resolve only one card.
    load(page, case['save'], speed='normal', reduced=False)
    baseline = json.loads(stored(page))['run']['combat']['stats']['cardsPlayed']
    card = page.locator('.battle-hand [data-card-uid="art-1"]')
    card.evaluate('(n)=>{n.dispatchEvent(new MouseEvent("click",{bubbles:true}));n.dispatchEvent(new MouseEvent("click",{bubbles:true}));}')
    page.wait_for_selector('.battle-screen[data-presentation-busy="true"]')
    assert page.locator('.end-turn-button').is_disabled()
    page.locator('.battle-skip-button').click()
    idle(page)
    assert json.loads(stored(page))['run']['combat']['stats']['cardsPlayed'] == baseline + 1
    # Game-level reduction is tested without relying on the OS media query.
    load(page, case['save'], speed='normal', reduced=True)
    assert page.locator('.app.reduced-motion').count() == 1
    assert page.locator('.world-scene').evaluate_all('(ns)=>ns.reduce((sum,n)=>sum+n.getAnimations({subtree:true}).filter(a=>a.playState==="running").length,0)') == 0


def scene_flow(page, width):
    load(page)
    page.get_by_role('button', name='第1階層へ進む', exact=False).click()
    page.get_by_role('button', name='この職業で探索を始める', exact=False).click()
    page.wait_for_selector('.blessing-screen')
    # Use a frozen public-action scene to compare every UI step exactly.
    load(page, DATA['scenes']['blessing'])
    assert page.locator('[data-blessing-option]').count() == 4
    page.locator(f'[data-blessing-option="{DATA["optionId"]}"]').get_by_role('button', name='この祝福の内容を確認', exact=False).click()
    assert stored(page) == DATA['flow'][0]['save']
    page.get_by_role('button', name='祝福を確定して受け取る', exact=False).click()
    assert stored(page) == DATA['flow'][1]['save']
    page.get_by_role('button', name='祝福を胸に、塔を登る', exact=False).click()
    assert stored(page) == DATA['flow'][2]['save']
    page.wait_for_selector('.run-map-scroll')
    action = DATA['flow'][3]['action']
    page.locator(f'[data-node-id="{action["nodeId"]}"]').click()
    idle(page)
    assert stored(page) == DATA['flow'][3]['save']
    page.reload(wait_until='networkidle')
    idle(page)
    assert stored(page) == DATA['flow'][3]['save']


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width, height in SIZES:
            context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 600, is_mobile=width < 600, reduced_motion='no-preference')
            context.set_default_timeout(12000)
            page = context.new_page()
            page.on('pageerror', lambda error: ERRORS.append(str(error)))
            page.on('console', lambda message: ERRORS.append(message.text) if message.type == 'error' else None)
            page.goto(URL, wait_until='networkidle')
            cases = [('title', 'title', None), ('blessing', 'blessing', DATA['scenes']['blessing']), ('map', 'map', DATA['scenes']['map'])]
            cases += [(case['name'], 'combat', case['save']) for case in [*DATA['fixtures'], *DATA['stress']]]
            for name, scene, raw in cases:
                if os.environ.get('QA_SCENE') and scene != os.environ['QA_SCENE']:
                    continue
                if os.environ.get('QA_CASE') and os.environ['QA_CASE'] not in name:
                    continue
                label = f'{name}-{width}x{height}'
                try:
                    value = capture(page, name, scene, raw, width, height)
                    case = next((case for case in DATA['fixtures'] if case['name'] == name), None)
                    if not BASELINE and not LAYOUT_ONLY and case:
                        if case['variant'] == 'single':
                            inspect_upgrades(page, case)
                        for step in case['steps']:
                            if step['action']['type'] == 'playCard':
                                play_card(page, step['action']['cardId'], width < 600)
                            else:
                                page.locator('.end-turn-button').click(); idle(page)
                            assert stored(page) == step['save'], f'Public action save mismatch: {step["action"]}'
                            check_resources(page, json.loads(step['save'])['run'])
                        page.reload(wait_until='networkidle'); idle(page)
                        assert stored(page) == case['steps'][-1]['save']
                    if not BASELINE and name in [case['name'] for case in DATA['stress']]:
                        stress_details(page, next(case for case in DATA['stress'] if case['name'] == name), width)
                    RESULTS.append({'name': label, 'result': 'PASS', 'geometry': value})
                    print(json.dumps({'name': label, 'result': 'PASS'}), flush=True)
                except Exception as error:
                    FAILURES.append({'name': label, 'error': str(error), 'trace': traceback.format_exc()})
                    page.screenshot(path=str(OUT / f'FAIL-{label}.png'))
                    print(json.dumps({'name': label, 'result': 'FAIL', 'error': str(error)}), flush=True)
            if not BASELINE and not LAYOUT_ONLY and not os.environ.get('QA_CASE') and not os.environ.get('QA_SCENE'):
                try:
                    scene_flow(page, width)
                    RESULTS.append({'name': f'public-scene-flow-{width}', 'result': 'PASS'})
                except Exception as error:
                    FAILURES.append({'name': f'public-scene-flow-{width}', 'error': str(error), 'trace': traceback.format_exc()})
                try:
                    interaction_checks(page, context, width)
                    RESULTS.append({'name': f'drag-lock-skip-reduced-{width}', 'result': 'PASS'})
                except Exception as error:
                    FAILURES.append({'name': f'drag-lock-skip-reduced-{width}', 'error': str(error), 'trace': traceback.format_exc()})
            context.close()
        browser.close()
    (OUT / 'results.json').write_text(json.dumps({'baseline': BASELINE, 'results': RESULTS, 'failures': FAILURES, 'browserErrors': ERRORS}, ensure_ascii=False, indent=2))
    print(json.dumps({'passed': len(RESULTS), 'failed': len(FAILURES), 'browserErrors': ERRORS}), flush=True)
    if FAILURES or ERRORS:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
