"""Sample real public combat presentation events, Canvas and WAAPI in Chromium.

This checks semantic cue order and stable HUD geometry, not a measured 60 fps
claim. Fixtures contain real reducer outcomes; presentation must preserve them.
"""
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('IWASON_ART_URL', 'http://127.0.0.1:5291/spyier/')
DATA = json.loads(Path(os.environ.get('IWASON_ART_FX_FIXTURES', '/tmp/spyier-art-effects-fixtures.json')).read_text())
OUT = Path(os.environ.get('IWASON_ART_FX_OUTPUT', '/tmp/spyier-art-effects'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'iwason-spire:run:v2'
RESULTS, FAILURES, ERRORS = [], [], []

MONITOR = '''()=>{
  window.artCueEvents=[];window.artFrames=[];window.artMonitoring=true;
  const props=['kind','sourceId','targetId','effect','amount','blocked','absorbed'];
  window.artListener=e=>{if(e.detail.phase!=='start')return;const c=e.detail.cue;
    window.artCueEvents.push(Object.fromEntries(props.filter(p=>c[p]!==undefined).map(p=>[p,c[p]])));
  };window.addEventListener('iwason:presentation',window.artListener);
  const rect=n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
  const sample=()=>{
    if(!window.artMonitoring)return;
    const arena=document.querySelector('.battle-arena'),layer=document.querySelector('.battle-effects-layer');
    if(arena&&layer){
      const canvas=layer.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let pixels=0;for(let i=3;i<data.length;i+=64)if(data[i])pixels++;
      const scenery=arena.querySelector(':scope > .world-scene');
      const animations=[...arena.querySelectorAll('[data-battle-actor],:scope > .world-scene')].flatMap(n=>n.getAnimations()
        .filter(a=>!(a instanceof CSSAnimation)&&!(a instanceof CSSTransition)&&a.playState==='running')
        .map(a=>({actor:n.dataset.battleActor??'scenery',easing:a.effect.getTiming().easing,
          frames:a.effect.getKeyframes().map(k=>({offset:k.offset,transform:k.transform,filter:k.filter}))})));
      window.artFrames.push({time:performance.now(),sequence:window.artCueEvents.length,cue:document.querySelector('.battle-screen').dataset.presentationCue,
        surface:layer.dataset.hitSurface,hold:Number(layer.dataset.hitHoldMs),shake:Number(layer.dataset.hitShakePx),
        quality:layer.dataset.effectsQuality,pixels,animations,scenery:scenery?getComputedStyle(scenery).transform:'none',
        labels:[...layer.querySelectorAll('.battle-number')].map(n=>n.textContent),
        hud:[...document.querySelectorAll('.topbar,.energy,.end-turn-button,.health-info')].map(rect)});
    }
    window.artMonitorRaf=requestAnimationFrame(sample);
  };window.artMonitorRaf=requestAnimationFrame(sample);
}'''


def idle(page):
    page.wait_for_selector('.battle-screen[data-presentation-busy="false"]', timeout=20000)


def load(page, case, speed='normal', reduced=False, quality='full'):
    page.evaluate('''x=>{localStorage.clear();localStorage.setItem(x.key,x.save);
      localStorage.setItem('iwason-spire:settings:v1',JSON.stringify({speed:x.speed,reducedMotion:x.reduced,effectsQuality:x.quality}));
    }''', {'key': KEY, 'save': case['save'], 'speed': speed, 'reduced': reduced, 'quality': quality})
    page.reload(wait_until='networkidle'); idle(page)
    assert page.evaluate('key=>localStorage.getItem(key)', KEY) == case['save']
    page.evaluate(MONITOR)
    page.wait_for_function('window.artFrames.length>1')


def action(page, case):
    if case['action']['type'] == 'endTurn':
        page.locator('.end-turn-button').click()
    else:
        page.locator(f'.battle-hand [data-card-uid="{case["action"]["cardId"]}"]').click()


def collect(page):
    return page.evaluate('''()=>{window.artMonitoring=false;cancelAnimationFrame(window.artMonitorRaf);
      window.removeEventListener('iwason:presentation',window.artListener);
      return {events:window.artCueEvents,frames:window.artFrames};}''')


def stable_hud(frames):
    baselines = {}
    for frame in frames:
        if frame['cue'] == 'idle':
            continue
        # Semantic snapshots can add/remove block badges or the skip control.
        # Compare within each cue, so the test detects camera motion without
        # mistaking legitimate content changes at boundaries for a shake.
        baseline = baselines.setdefault(frame['sequence'], frame['hud'])
        assert len(frame['hud']) == len(baseline), 'Combat controls disappeared during a cue'
        for before, after in zip(baseline, frame['hud']):
            # Numerals can change text width; positions stay fixed within a cue.
            assert abs(before[0] - after[0]) < 1 and abs(before[1] - after[1]) < 1, ('HUD moved with impact', before, after)


def plateau(frames):
    for frame in frames:
        if frame['hold'] <= 0:
            continue
        for animation in frame['animations']:
            keys = animation['frames']
            if animation['actor'] != 'scenery' and len(keys) >= 3 and keys[0].get('transform') == keys[1].get('transform'):
                assert animation['easing'] == 'linear', animation
                assert keys[1]['offset'] > keys[0]['offset'], animation
                return True
    return False


def verify(page, case, result, immediate=False, skipped=False, quality='full'):
    assert page.evaluate('key=>localStorage.getItem(key)', KEY) == case['expectedSave'], 'Presentation changed reducer/save outcome'
    frames = result['frames']
    assert frames
    stable_hud(frames)
    if immediate:
        assert result['events'] == [], 'Reduced/instant unexpectedly ran the timeline'
        assert all(frame['hold'] == 0 and frame['shake'] == 0 and frame['pixels'] == 0 and not frame['labels'] for frame in frames)
    elif skipped:
        assert len(result['events']) < len(case['cues'])
        tail = frames[-1]
        assert tail['pixels'] == 0 and not tail['labels'] and not tail['animations'], ('Effects survived skip', tail)
    else:
        assert result['events'] == case['cues'], ('Cue order/actual hit amounts diverged', result['events'], case['cues'])
        assert any(frame['pixels'] > 0 for frame in frames), 'Canvas never drew a local effect'
        assert all(frame['quality'] == quality for frame in frames)
        assert any(frame['labels'] for frame in frames), 'Effect numbers/labels never appeared'
        health = [frame for frame in frames if frame.get('surface') == 'health']
        if health:
            assert plateau(health), 'No contact-pose hold was observed'
            assert any(frame['scenery'] != 'none' and frame['animations'] for frame in health), 'Backdrop shake absent'
            assert max(frame['shake'] for frame in health) <= (2.4 if quality == 'low' else 5)
        if case['name'] == 'multi-attack':
            assert len([cue for cue in result['events'] if cue['kind'] == 'impact']) == 2
        if case['name'] == 'shield-contact':
            assert any(frame.get('surface') == 'shield' and frame['hold'] > 0 and frame['shake'] == 0 for frame in frames)
        if case['name'] == 'hp-sacrifice':
            assert any(frame.get('surface') == 'cost' and frame['hold'] == 0 and frame['shake'] == 0 for frame in frames)
    page.reload(wait_until='networkidle'); idle(page)
    assert page.evaluate('key=>localStorage.getItem(key)', KEY) == case['expectedSave'], 'Reload changed the settled outcome'


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1366, 'height': 768}, reduced_motion='no-preference')
        context.set_default_timeout(12000)
        page = context.new_page()
        page.on('pageerror', lambda error: ERRORS.append(str(error)))
        page.on('console', lambda message: ERRORS.append(message.text) if message.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        variants = [(case, 'normal', False, 'full', False) for case in DATA['cases']]
        single = next(case for case in DATA['cases'] if case['name'] == 'single-attack')
        variants += [(single, 'normal', False, 'low', False), (single, 'normal', True, 'full', False),
                     (single, 'instant', False, 'full', False), (single, 'normal', False, 'full', True),
                     (single, 'fast', False, 'full', False)]
        for case, speed, reduced, quality, skipped in variants:
            name = f'{case["name"]}-{speed}-{quality}-{"reduced" if reduced else "skip" if skipped else "animated"}'
            try:
                load(page, case, speed, reduced, quality)
                action(page, case)
                if skipped:
                    page.wait_for_function('window.artFrames.some(f=>f.cue==="impact")')
                    page.locator('.battle-skip-button').click()
                elif not reduced and speed != 'instant':
                    expected = 'block' if case['name'] == 'defend' else 'impact'
                    page.wait_for_function('(kind)=>window.artFrames.some(f=>f.cue===kind&&f.pixels>0)', arg=expected)
                    page.screenshot(path=str(OUT / f'{name}.png'))
                idle(page)
                page.wait_for_timeout(50)
                result = collect(page)
                (OUT / f'{name}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
                verify(page, case, result, immediate=reduced or speed == 'instant', skipped=skipped, quality=quality)
                RESULTS.append({'name': name, 'result': 'PASS'})
                print(json.dumps(RESULTS[-1]), flush=True)
            except Exception as error:
                FAILURES.append({'name': name, 'error': str(error), 'trace': traceback.format_exc()})
                page.screenshot(path=str(OUT / f'FAIL-{name}.png'))
                print(json.dumps({'name': name, 'result': 'FAIL', 'error': str(error)}), flush=True)
        browser.close()
    (OUT / 'results.json').write_text(json.dumps({'results': RESULTS, 'failures': FAILURES, 'browserErrors': ERRORS}, ensure_ascii=False, indent=2))
    print(json.dumps({'passed': len(RESULTS), 'failed': len(FAILURES), 'browserErrors': ERRORS}), flush=True)
    if FAILURES or ERRORS:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
