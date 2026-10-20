"""Real Chromium checks for the compact battle UI (no application test hooks).

Requires the Python Playwright package and Chromium. Start Vite, generate the
fixture JSON with compact-battle-fixtures.ts, then run this file. Override
IWASON_BROWSER_URL / IWASON_BROWSER_FIXTURES / IWASON_BROWSER_OUTPUT as needed.
Fixture combat resources are stress arrangements, not a balance simulation.
"""
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_BROWSER_URL', 'http://127.0.0.1:5282/spyier/')
FIXTURES = Path(os.environ.get('IWASON_BROWSER_FIXTURES', '/tmp/spyier-compact-fixtures.json'))
OUT = Path(os.environ.get('IWASON_BROWSER_OUTPUT', '/tmp/spyier-compact-browser'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'iwason-spire:run:v2'
CASES = json.loads(FIXTURES.read_text())['fixtures']
ERRORS = []
RESULTS = []
FAILURES = []
PREFLIGHT = os.environ.get('IWASON_BROWSER_PREFLIGHT') == '1'
DRAG_ONLY = os.environ.get('IWASON_BROWSER_DRAG_ONLY') == '1'
SIZES = [(1920, 1080), (1366, 768), (390, 844)]
if os.environ.get('QA_WIDTH'):
    SIZES = [size for size in SIZES if size[0] == int(os.environ['QA_WIDTH'])]
if os.environ.get('IWASON_BROWSER_VIEWPORT'):
    width,height=map(int,os.environ['IWASON_BROWSER_VIEWPORT'].split('x'))
    assert width>0 and height>0,'Viewport dimensions must be positive'
    SIZES=[(width,height)]
if os.environ.get('QA_CASE'):
    CASES = [case for case in CASES if os.environ['QA_CASE'] in case['name']]

def saved(page):
    return page.evaluate('(key) => localStorage.getItem(key)', KEY)

def idle(page):
    page.wait_for_selector('.battle-screen[data-presentation-busy="false"]', timeout=15000)

def load(page, case, speed='instant', reduced=False):
    page.evaluate('''(x) => {
      localStorage.clear(); localStorage.setItem(x.key, x.save);
      localStorage.setItem('iwason-spire:settings:v1', JSON.stringify({speed:x.speed, reducedMotion:x.reduced, effectsQuality:'full'}));
    }''', {'key': KEY, 'save': case['save'], 'speed': speed, 'reduced': reduced})
    page.reload(wait_until='networkidle')
    page.wait_for_selector('.battle-screen')
    idle(page)
    assert saved(page) == case['save'], 'Loading changed fixture save'

def geometry(page):
    return page.evaluate('''() => {
      const rect = n => {
        const r=n.getBoundingClientRect();
        const hit=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.x+r.width/2)), Math.min(innerHeight-1,Math.max(0,r.y+r.height/2)));
        return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,
          inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,
          exposed:!!hit&&(n.contains(hit)||hit.contains(n)),text:n.textContent?.trim().slice(0,70)};
      };
      const selectors=['.topbar','.battle-screen','.battle-arena','.battle-hand','.battle-hand-cards','.energy','.end-turn-button',
        '.pile-button','.enemy-intent','.health-info','.class-resource-readout','.orb-slots','.class-orb-slot','.osty-companion','.star-energy',
        '.hud-potions','.hud-relics','.character-stage','.actor-motion > svg'];
      const nodes=Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].map(rect)]));
      return {width:innerWidth,height:innerHeight,scrollY,scrollX,scrollHeight:document.documentElement.scrollHeight,
        scrollWidth:document.documentElement.scrollWidth,nodes};
    }''')

def verify_layout(page, case, width, height):
    value = geometry(page)
    failures=[]
    if value['scrollHeight'] > height+2: failures.append(f"page scroll height {value['scrollHeight']} > {height}")
    if value['scrollWidth'] > width+2: failures.append(f"page horizontal overflow {value['scrollWidth']} > {width}")
    if value['scrollY'] != 0: failures.append(f"page unexpectedly scrolled {value['scrollY']}")
    required=['.battle-arena','.battle-hand','.battle-hand-cards','.energy','.end-turn-button','.pile-button','.enemy-intent','.health-info','.class-resource-readout','.hud-potions','.hud-relics','.character-stage','.actor-motion > svg']
    if case['classId']=='machinist': required.append('.class-orb-slot')
    if case['classId']=='necromancer': required.append('.osty-companion')
    if case['classId']=='oracle': required.append('.star-energy')
    for selector in required:
        for index, rect in enumerate(value['nodes'][selector]):
            if not rect['inside']: failures.append(f'{selector}[{index}] offscreen: {rect}')
            if rect['w']<5 or rect['h']<5: failures.append(f'{selector}[{index}] has no visible area: {rect}')
        if not value['nodes'][selector]: failures.append(f'missing {selector}')
    arena=value['nodes']['.battle-arena'][0]
    hand=value['nodes']['.battle-hand'][0]
    if arena['bottom'] > hand['y']+2: failures.append(f'hand overlaps battle arena {arena["bottom"]} > {hand["y"]}')
    # Verify the live targets/controls, rather than allowing overflow:hidden to
    # make a clipped page appear to fit. Text can itself be the hit-test result.
    for selector in ['.end-turn-button','.enemy-intent','.class-resource-readout','.hud-potions']:
        for index, rect in enumerate(value['nodes'][selector]):
            if not rect['exposed']: failures.append(f'{selector}[{index}] hidden under another element')
    return value,failures

def assert_resource_values(page, run):
    state=run['combat']; job=run['classId']; r=state['classResources']
    assert page.locator(f'[data-player-class="{job}"]').count()==1
    assert page.locator(f'.combatant--player [data-character-class="{job}"]').count()==1
    if job=='machinist':
        actual=page.locator('.class-orb-slot').evaluate_all('(ns)=>ns.map(n=>({type:n.dataset.orbType,next:n.dataset.nextEvoke==="true"}))')
        maximum=3+state.get('orbSlotBonus',0)
        expected=[{'type':r['orbs'][i] if i<len(r['orbs']) else 'empty','next':i==len(r['orbs'])-1} for i in range(maximum)]
        assert actual==expected,(actual,expected)
        assert page.locator('[data-resource-hud="focus"] b').inner_text()==('+' if r['focus']>0 else '')+str(r['focus'])
    if job=='necromancer': assert page.locator('.osty-unit-hp b').inner_text()==str(r['ostyHp'])
    if job=='oracle':
        assert page.locator('.star-energy-gem b').inner_text()==str(r['stars'])
        assert page.locator('.star-energy-label small b').inner_text()=='+'+str(r['starsGainedThisTurn'])
        assert page.locator('[data-resource-hud="forge"] b').inner_text()==str(r['forge'])
    if job=='berserker': assert page.locator('[data-resource-hud="strength"] b').inner_text()==str(state['player']['strength'])
    if job=='assassin': assert page.locator('[data-resource-hud="knife"] b').inner_text()=='+'+str(state.get('powerStacks',{}).get('knifeDamage',0))
    for key, label in [('dexterity', '敏捷'), ('vigor', '活力'), ('plate', 'プレート')]:
        if state.get(key, 0):
            assert page.locator(f'.combatant--player .status-chip[aria-label^="{label} "] b').inner_text()==str(state[key])

def assert_detail_bounds(page):
    panel=page.locator('.battle-card-inspector')
    panel.wait_for(state='visible')
    rect=panel.bounding_box(); viewport=page.viewport_size
    assert rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=viewport['width']+1 and rect['y']+rect['height']<=viewport['height']+1,('card detail offscreen',rect)
    for selector in ['.card-description','.card-runtime']:
        clips=panel.locator(selector).evaluate_all('(ns)=>ns.filter(n=>n.scrollHeight>n.clientHeight+2).map(n=>({text:n.textContent,height:n.clientHeight,scroll:n.scrollHeight}))')
        assert not clips,('card detail clipped',clips)

def play_click(page, uid, width):
    source=page.locator(f'.battle-hand [data-card-uid="{uid}"]')
    source.scroll_into_view_if_needed()
    if width<600:
        before=saved(page);source.tap();assert_detail_bounds(page)
        assert saved(page)==before,'Tap-to-inspect played a card'
        page.locator('.battle-card-inspector').get_by_role('button',name='このカードを使用',exact=True).tap()
    else:
        source.click()
    idle(page)

def drag(page, context, uid, target, valid, width):
    page.keyboard.press('Escape')
    source=page.locator(f'.battle-hand [data-card-uid="{uid}"]')
    source.scroll_into_view_if_needed()
    page.mouse.move(0,0)
    rect=source.bounding_box()
    x=rect['x']+min(rect['width']/2, max(10, page.viewport_size['width']-rect['x']-12))
    y=rect['y']+rect['height']/2
    destination=target.bounding_box()
    tx=destination['x']+destination['width']/2
    ty=destination['y']+destination['height']/2
    if width<600:
        cdp=context.new_cdp_session(page)
        def touch(kind,x=None,y=None):
            cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if x is None else [{'x':x,'y':y}]})
        touch('touchStart',x,y)
        # Begin vertically, reserving horizontal touch swipes for hand scrolling.
        for step in range(1,5):touch('touchMove',x,y-8*step)
        for step in range(1,11):touch('touchMove',x+(tx-x)*step/10,(y-32)+(ty-y+32)*step/10)
    else:
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(tx,ty,steps=15)
    page.wait_for_selector('.battle-card-ghost')
    page.wait_for_function('(expected)=>document.querySelector(".card-drag-overlay")?.dataset.valid===String(expected)',arg=valid)
    if width<600:touch('touchEnd');cdp.detach()
    else:page.mouse.up()
    idle(page)
    page.wait_for_function('!document.querySelector("[data-card-drop]")')
    assert page.get_by_role('dialog').count()==0, 'Drag drop unexpectedly opened a detail dialog'
    assert page.evaluate('scrollY')==0, 'Dragging scrolled the document'

def check_drag_potions_and_lock(page, context, case, width):
    # Large fixtures include the same ordinary guard and strike for all jobs.
    # Validate cancel, self drop, and targeting a different enemy without hooks.
    load(page,case)
    if width<600:
        before_swipe=saved(page)
        hand=page.locator('.battle-hand-cards').bounding_box()
        cdp=context.new_cdp_session(page)
        start=width-35;y=hand['y']+hand['height']/2
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':start,'y':y}]})
        for step in range(1,13):
            cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':start-250*step/12,'y':y}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cdp.detach()
        page.wait_for_function('document.querySelector(".battle-hand-cards").scrollLeft>10')
        assert saved(page)==before_swipe and page.evaluate('scrollY')==0,'Horizontal swipe played a card or scrolled the page'
        assert page.locator('.battle-card-ghost').count()==0,'Horizontal swipe became a card drag'
        page.locator('.battle-hand-cards').evaluate('n=>n.scrollLeft=0')
    before=json.loads(saved(page))['run']['combat']
    player=page.locator('.combatant--player .character-stage')
    drag(page,context,'compact-7',player,False,width)
    assert json.loads(saved(page))['run']['combat']==before, 'Invalid drop changed combat'
    drag(page,context,'compact-6',player,True,width)
    after=json.loads(saved(page))['run']['combat']
    assert after['stats']['cardsPlayed']==before['stats']['cardsPlayed']+1 and after['player']['block']>before['player']['block']
    before=after
    target=page.locator('[data-enemy-id]').nth(1)
    enemy_id=target.get_attribute('data-enemy-id')
    drag(page,context,'compact-7',target,True,width)
    after=json.loads(saved(page))['run']['combat']
    assert after['stats']['cardsPlayed']==before['stats']['cardsPlayed']+1
    assert after['selectedEnemyId']==enemy_id
    assert after['enemies'][0]['hp']==before['enemies'][0]['hp'] and after['enemies'][1]['hp']<before['enemies'][1]['hp'] and after['enemies'][2]['hp']==before['enemies'][2]['hp']
    # Zero-energy item use is still reachable and consumes exactly one slot.
    old_block=after['player']['block']
    page.locator('[data-potion-slot="0"]').click();idle(page)
    after=json.loads(saved(page))['run']['combat']
    assert after['potions'][0] is None and after['player']['block']>old_block
    # Use normal timing to exercise the synchronous UI action gate and skip.
    load(page,case,speed='normal')
    before=json.loads(saved(page))['run']['combat']
    card=page.locator('.battle-hand [data-card-uid="compact-6"]')
    card.scroll_into_view_if_needed()
    card.evaluate('''(node)=>{node.dispatchEvent(new MouseEvent('click',{bubbles:true}));node.dispatchEvent(new MouseEvent('click',{bubbles:true}));}''')
    page.wait_for_selector('.battle-screen[data-presentation-busy="true"]')
    assert page.locator('.end-turn-button').is_disabled()
    idle(page)
    after=json.loads(saved(page))['run']['combat']
    assert after['stats']['cardsPlayed']==before['stats']['cardsPlayed']+1, 'Repeated click used more than one card'
    guard_only_save=saved(page)
    # An enemy turn provides a long enough live sequence to click the skip
    # control reliably, rather than racing a single 100 ms guard cue.
    page.locator('.end-turn-button').click()
    page.wait_for_selector('.battle-screen[data-presentation-busy="true"]')
    page.get_by_role('button',name='戦闘演出をスキップ',exact=True).click();idle(page)
    final=saved(page);page.reload(wait_until='networkidle');idle(page);assert saved(page)==final
    for speed,reduced in [('fast',False),('normal',True)]:
        load(page,case,speed=speed,reduced=reduced)
        play_click(page,'compact-6',width)
        assert saved(page)==guard_only_save,'Presentation settings changed the authoritative combat result'
    return (['touch hand swipe'] if width<600 else [])+['invalid drop','self guard drop','second enemy attack','potion single use','repeat-click lock','normal-speed skip','reload','fast speed','reduced motion']

def check_modals(page, case):
    before=saved(page)
    page.locator('.class-resource-readout').click();page.get_by_role('dialog').wait_for()
    assert page.locator('.class-resource-detail-copy').count()==1
    page.get_by_role('button',name='閉じる',exact=True).click()
    if case['classId']=='machinist':
        for index in range(page.locator('.class-orb-slot').count()):
            page.locator('.class-orb-slot').nth(index).click()
            page.get_by_role('dialog').wait_for()
            assert f'スロット{index+1}' in page.get_by_role('dialog').inner_text()
            page.get_by_role('button',name='閉じる',exact=True).click()
    if case['classId']=='necromancer':
        page.locator('.osty-companion').click();page.get_by_role('dialog').wait_for()
        assert '護衛' in page.get_by_role('dialog').inner_text()
        page.get_by_role('button',name='閉じる',exact=True).click()
    page.locator('.hud-relics').click();page.get_by_role('dialog').wait_for()
    shown_relics=page.get_by_role('dialog').locator('.relic-collection [data-relic-id]').evaluate_all('(nodes)=>nodes.map(node=>node.dataset.relicId)')
    assert shown_relics==json.loads(before)['run']['relicIds'],('Relic collection differs from owned inventory',shown_relics)
    page.get_by_role('button',name='閉じる',exact=True).click()
    page.locator('.enemy-inspect-button').first.click();page.get_by_role('dialog').wait_for()
    assert page.get_by_role('dialog').inner_text().strip()
    page.get_by_role('button',name='閉じる',exact=True).click()
    for pile in ['drawPile','discardPile','exhaustPile']:
        page.locator(f'[data-battle-pile="{pile}"]').click();page.get_by_role('dialog').wait_for()
        page.get_by_role('button',name='閉じる',exact=True).click()
    for chip in [page.locator('.combatant--player .status-chip').last, page.locator('.enemy-status .status-chip').last]:
        if not chip.count():continue
        chip.tap() if page.viewport_size['width']<600 else chip.focus()
        tooltip=page.locator('.battle-status-tooltip').last
        tooltip.wait_for(state='visible')
        box=tooltip.bounding_box();viewport=page.viewport_size
        assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=viewport['width'] and box['y']+box['height']<=viewport['height'],('status tooltip offscreen',box)
        # A body portal with a high stacking level keeps the explanation above
        # the card dock and actor animation stacking contexts on phones.
        assert tooltip.evaluate('n=>n.parentElement===document.body && Number(getComputedStyle(n).zIndex)>=100')
        page.keyboard.press('Escape')
        page.locator('.battle-heading').click(position={'x':5,'y':5})
    assert saved(page)==before,'Inspection changed game state'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in SIZES:
        context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<600,is_mobile=width<600)
        context.set_default_timeout(8000)
        page=context.new_page();page.on('pageerror',lambda error:ERRORS.append(str(error)))
        page.on('console',lambda message:ERRORS.append(f'console.error: {message.text}') if message.type=='error' else None)
        page.goto(URL,wait_until='networkidle')
        for case in CASES:
            name=f'{case["name"]}-{width}'
            try:
                if DRAG_ONLY:
                    if case['variant']!='large':continue
                    checks=check_drag_potions_and_lock(page,context,case,width)
                    RESULTS.append({'case':name,'result':'PASS','checks':checks})
                    print(json.dumps({'case':name,'result':'PASS','checks':checks}),flush=True)
                    continue
                load(page,case)
                measurements, failures=verify_layout(page,case,width,height)
                assert_resource_values(page,json.loads(case['save'])['run'])
                if case['variant'] in ['triple','large']:
                    page.screenshot(path=str(OUT/f'{name}.png'),full_page=True)
                if PREFLIGHT:
                    RESULTS.append({'case':name,'layoutFailures':failures,'measurements':measurements})
                    if failures: FAILURES.append({'case':name,'error':'layout failures','failures':failures})
                    print(json.dumps({'case':name,'failures':failures}),flush=True)
                    continue
                assert not failures,failures
                check_modals(page,case)
                # Both left and right extremes have a viewport-clamped full
                # card preview. Internal scroll must not move the document.
                for index in [0,-1]:
                    card=page.locator('.battle-hand-slot').nth(index)
                    card.scroll_into_view_if_needed()
                    if width<600:
                        card.locator('.battle-card-detail-button').tap()
                    else:
                        card.hover()
                    assert_detail_bounds(page)
                    page.keyboard.press('Escape')
                    assert page.evaluate('scrollY')==0,'Hand scrolling moved page'
                if case['variant']=='large':
                    overflow=page.locator('.battle-hand-cards').evaluate('(n)=>({scroll:n.scrollWidth,client:n.clientWidth,left:n.scrollLeft})')
                    assert overflow['scroll']>overflow['client'] and overflow['left']>0,overflow
                    assert page.locator('.hand-scroll-controls').is_visible()
                page.locator('.battle-hand-cards').evaluate('(n)=>n.scrollLeft=0')
                for step in case['steps']:
                    action=step['action']
                    if action['type']=='playCard': play_click(page,action['cardId'],width)
                    else: page.locator('.end-turn-button').click();idle(page)
                    assert saved(page)==step['save'],f'Public {action} differs from engine'
                    assert_resource_values(page,json.loads(step['save'])['run'])
                final=saved(page);page.reload(wait_until='networkidle');idle(page)
                assert saved(page)==final,'Reload changed final combat'
                final_measurements, final_failures=verify_layout(page,case,width,height)
                assert not final_failures,final_failures
                RESULTS.append({'case':name,'result':'PASS','publicActions':len(case['steps']),'measurements':measurements,'afterTurn':final_measurements})
                print(json.dumps({'case':name,'result':'PASS','actions':len(case['steps'])}),flush=True)
            except Exception as error:
                failures={'case':name,'error':str(error),'traceback':traceback.format_exc(),'measurements':geometry(page)}
                print(traceback.format_exc(),flush=True)
                FAILURES.append(failures);print(json.dumps({'case':name,'FAIL':str(error)}),flush=True)
                page.screenshot(path=str(OUT/f'FAIL-{name}.png'),full_page=True)
        context.close()
    browser.close()
report={'url':URL,'cases':RESULTS,'failures':FAILURES,'browserErrors':ERRORS}
(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'cases':len(RESULTS),'failures':len(FAILURES),'browserErrors':ERRORS,'output':str(OUT)},ensure_ascii=False),flush=True)
assert not FAILURES and not ERRORS,'Browser checks failed; see results.json'
