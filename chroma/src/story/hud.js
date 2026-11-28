// Story-mode HUD: its own DOM root + injected <style>, both removed on dispose.
import { SPEAKERS } from './dialogue.js';

const SPLAT = 'M50 6c9 0 10 14 18 15s16-9 21-1-6 16-1 23 17 6 13 16-17 3-21 9 1 20-8 22-12-11-20-9-11 15-20 11 2-16-5-21-20 2-21-8 12-12 11-20-14-8-12-18 15-5 21-11-2-23 6-26 9 9 16 6 3-7 9-7z';

const CSS = `
#story-hud { position: fixed; inset: 0; z-index: 20; pointer-events: none; font-family: var(--hfont, 'Lilita One', sans-serif); color: #fff; --pc: #ff2e88; --panel: rgba(27,21,48,.82); --dk: #1b1530; }
#story-hud > div { position: absolute; }
#story-hud .sh-card { left: 20px; top: 18px; background: var(--panel); border-radius: 18px; padding: 10px 16px 12px; min-width: 230px; max-width: min(420px, 60vw); box-shadow: 0 8px 24px rgba(0,0,0,.3); }
#story-hud .sh-level { display: flex; align-items: center; gap: 10px; font-size: 22px; letter-spacing: .5px; }
#story-hud .sh-num { display: grid; place-items: center; min-width: 32px; height: 32px; padding: 0 6px; border-radius: 10px; background: var(--lc, var(--pc)); color: var(--dk); font-size: 20px; }
#story-hud .sh-obj { margin-top: 6px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 14.5px; color: #e6e1ff; line-height: 1.3; }
#story-hud .sh-obj b { color: #ffd21a; font-weight: 900; }
#story-hud .sh-right { right: 20px; top: 18px; display: flex; gap: 10px; align-items: center; }
#story-hud .sh-pill { background: var(--panel); border-radius: 16px; padding: 9px 14px; font-size: 17px; display: flex; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.3); }
#story-hud .sh-pill .coin { color: #ffd21a; }
#story-hud .sh-sw i { width: 18px; height: 26px; border-radius: 4px; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); display: block; }
#story-hud .sh-sw.found i { background: linear-gradient(#fff 0 14%, var(--s1) 14% 42%, var(--s2) 42% 70%, var(--s3) 70%); box-shadow: 0 0 0 2px var(--dk), 0 0 12px var(--s2); }
#story-hud .sh-sw.found { animation: sh-pop .4s cubic-bezier(.2,1.8,.4,1); }
#story-hud .sh-sw span { font-size: 15px; } #story-hud .sh-sw small { display: block; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 11px; color: #a9a3c9; }
#story-hud .sh-vitals { left: 20px; bottom: 20px; background: var(--panel); border-radius: 18px; padding: 10px 14px; display: grid; gap: 7px; min-width: 220px; box-shadow: 0 8px 24px rgba(0,0,0,.3); }
#story-hud .sh-bar { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: center; font-size: 16px; }
#story-hud .sh-bar > div { height: 12px; border-radius: 7px; background: rgba(0,0,0,.45); overflow: hidden; box-shadow: inset 0 0 0 2px rgba(255,255,255,.08); }
#story-hud .sh-bar i { display: block; height: 100%; width: 100%; border-radius: 7px; transition: width .12s; }
#story-hud .sh-hp b { color: #ff6b8a; } #story-hud .sh-hp i { background: linear-gradient(90deg, #ff4d6d, #ff9a7a); }
#story-hud .sh-ink b { color: var(--pc); } #story-hud .sh-ink i { background: var(--pc); box-shadow: 0 0 10px var(--pc); }
#story-hud .sh-vitals.low .sh-ink i { background: #ff5d5d; animation: sh-blink .4s steps(2) infinite; }
#story-hud .sh-vitals.hurt .sh-hp i { animation: sh-blink .3s steps(2) infinite; }
#story-hud .sh-ret { left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.9); box-shadow: 0 0 0 1px rgba(0,0,0,.45); opacity: 0; transition: opacity .2s, transform .08s; }
#story-hud .sh-ret.on { opacity: 1; } #story-hud .sh-ret.goo { opacity: .3; }
#story-hud .sh-ret.target { border-color: #ffd21a; transform: scale(1.18); }
#story-hud .sh-ret::after { content: ''; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: #fff; }
#story-hud .sh-ret svg { position: absolute; left: -24px; top: -24px; width: 70px; height: 70px; overflow: visible; }
#story-hud .sh-ret .hit { stroke: #fff; stroke-width: 3; stroke-linecap: round; opacity: 0; filter: drop-shadow(0 0 2px rgba(0,0,0,.9)); }
#story-hud .sh-ret.hit .hit { opacity: 1; } #story-hud .sh-ret.kill .hit { opacity: 1; stroke: #ffd21a; } #story-hud .sh-ret.block .hit { opacity: .8; stroke: #9a97a3; }
#story-hud .sh-boss { left: 50%; top: 16px; transform: translateX(-50%); width: min(620px, 70vw); text-align: center; opacity: 0; transition: opacity .4s; }
#story-hud .sh-boss.on { opacity: 1; }
#story-hud.boss-on .sh-card, #story-hud.boss-on .sh-right { opacity: 0 !important; }
#story-hud .sh-boss .nm { font-size: 22px; letter-spacing: 1px; -webkit-text-stroke: 4px var(--dk); paint-order: stroke fill; }
#story-hud .sh-boss .bar { height: 20px; border-radius: 12px; background: rgba(0,0,0,.55); box-shadow: 0 0 0 4px var(--dk), 0 8px 20px rgba(0,0,0,.4); overflow: hidden; margin-top: 6px; position: relative; }
#story-hud .sh-boss .bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #9a97a3, #d8d4e2); transition: width .25s; }
#story-hud .sh-boss .bar u { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,255,255,.35); transition: width 1.2s .3s; }
#story-hud .sh-boss .bar em { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--dk); }
#story-hud .sh-boss .ph { margin-top: 7px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 13px; letter-spacing: .6px; color: #ffd21a; text-shadow: 0 2px 0 var(--dk); }
#story-hud .sh-tip { left: 50%; bottom: 150px; transform: translate(-50%, 12px); max-width: min(680px, 90vw); background: var(--panel); border-radius: 16px; padding: 11px 18px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 15.5px; line-height: 1.35; text-align: center; opacity: 0; transition: opacity .3s, transform .3s; box-shadow: 0 8px 24px rgba(0,0,0,.3), inset 0 0 0 2px rgba(255,210,26,.35); }
#story-hud .sh-tip.on { opacity: 1; transform: translate(-50%, 0); }
#story-hud .sh-tip b { color: #ffd21a; font-family: var(--hfont, sans-serif); font-weight: 400; letter-spacing: .3px; }
#story-hud .sh-tip::before { content: 'TIP'; font-family: var(--hfont, sans-serif); font-weight: 400; color: var(--dk); background: #ffd21a; border-radius: 8px; padding: 1px 7px; margin-right: 8px; font-size: 13px; }
#story-hud .sh-prompt { left: 50%; bottom: 17%; transform: translate(-50%, 16px); background: rgba(27,21,48,.9); padding: 9px 20px 9px 9px; border-radius: 999px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 17px; display: flex; align-items: center; gap: 10px; opacity: 0; transition: all .2s cubic-bezier(.2,1.4,.4,1); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
#story-hud .sh-prompt.on { opacity: 1; transform: translate(-50%, 0); }
#story-hud .sh-prompt b { color: #ffd21a; font-family: var(--hfont, sans-serif); font-weight: 400; }
#story-hud .sh-key { display: inline-grid; place-items: center; min-width: 34px; height: 34px; padding: 0 6px; border-radius: 10px; background: #fffaf0; color: var(--dk); font-family: var(--hfont, sans-serif); font-size: 19px; box-shadow: 0 3px 0 #b9b2d6; }
#story-hud .sh-toast { left: 50%; top: 92px; transform: translate(-50%, -14px); background: rgba(27,21,48,.92); padding: 10px 20px; border-radius: 999px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 16px; opacity: 0; transition: all .25s; white-space: nowrap; }
#story-hud .sh-toast.on { opacity: 1; transform: translate(-50%, 0); }
#story-hud .sh-toast b { color: #ffd21a; }
#story-hud .sh-banner { left: 0; right: 0; top: 15%; text-align: center; opacity: 0; transform: scale(.7); transition: opacity .25s, transform .4s cubic-bezier(.2,1.8,.4,1); }
#story-hud .sh-banner.on { opacity: 1; transform: none; }
#story-hud .sh-banner .m { font-size: clamp(40px, 7vw, 82px); line-height: 1; letter-spacing: 2px; -webkit-text-stroke: 8px var(--dk); paint-order: stroke fill; text-shadow: 0 8px 0 var(--dk); }
#story-hud .sh-banner .s { margin-top: 10px; font-size: clamp(20px, 3vw, 30px); -webkit-text-stroke: 5px var(--dk); paint-order: stroke fill; color: #ffd21a; }
#story-hud .sh-banner .m span { display: inline-block; animation: sh-letter 1.6s ease-in-out infinite; animation-delay: calc(var(--i) * .06s); }
#story-hud .sh-warn { left: 50%; top: 30%; transform: translateX(-50%); background: rgba(80,20,24,.88); border-radius: 16px; padding: 10px 22px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 18px; opacity: 0; transition: opacity .2s; box-shadow: 0 0 0 3px #ff5d5d, 0 10px 30px rgba(0,0,0,.4); white-space: nowrap; }
#story-hud .sh-warn.on { opacity: 1; animation: sh-throb .5s ease-in-out infinite alternate; }
#story-hud .sh-warn b { color: #ffd21a; }
#story-hud .sh-splat { left: 0; right: 0; bottom: 30%; text-align: center; opacity: 0; transition: opacity .3s; }
#story-hud .sh-splat.on { opacity: 1; }
#story-hud .sh-splat .t { font-size: 60px; color: #b9b5c4; -webkit-text-stroke: 7px var(--dk); paint-order: stroke fill; text-shadow: 0 6px 0 var(--dk); }
#story-hud .sh-splat .u { font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 18px; text-shadow: 0 2px 0 var(--dk); }
#story-hud .sh-hurt { inset: 0; overflow: hidden; }
#story-hud .sh-hurt div { position: absolute; width: 360px; height: 360px; transform: translate(-50%, -50%) rotate(var(--r)) scale(var(--s)); animation: sh-hurt 1.4s ease-out forwards; }
#story-hud .sh-hurt svg { width: 100%; height: 100%; fill: #7d7a88; opacity: .8; }
#story-hud .sh-dialog { left: 50%; bottom: 26px; transform: translate(-50%, 30px); width: min(760px, 92vw); opacity: 0; transition: opacity .25s, transform .3s cubic-bezier(.2,1.4,.4,1); }
#story-hud .sh-dialog.on { opacity: 1; transform: translate(-50%, 0); }
#story-hud .sh-dialog .box { position: relative; background: rgba(27,21,48,.94); border-radius: 24px; padding: 26px 26px 20px 112px; min-height: 118px; box-shadow: 0 16px 44px rgba(0,0,0,.5), inset 0 0 0 3px rgba(255,255,255,.1); }
#story-hud .sh-dialog.radio { left: auto; right: 20px; bottom: 20px; width: min(500px, 56vw); transform: translate(0, 30px); }
#story-hud .sh-dialog.radio.on { transform: none; }
#story-hud .sh-dialog.radio .box { padding: 22px 20px 16px 92px; min-height: 86px; background: rgba(27,21,48,.86); }
#story-hud .sh-dialog .who { position: absolute; left: 104px; top: -16px; background: var(--sc); color: var(--dk); padding: 4px 16px; border-radius: 999px; font-size: 19px; letter-spacing: .4px; box-shadow: 0 4px 0 rgba(0,0,0,.35); transform: rotate(-1.5deg); }
#story-hud .sh-dialog.radio .who { left: 84px; font-size: 16px; }
#story-hud .sh-dialog .who small { font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 11px; margin-left: 8px; opacity: .7; letter-spacing: 1px; }
#story-hud .sh-dialog .face { position: absolute; left: 18px; top: 18px; width: 78px; height: 78px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 45%), var(--sc); display: grid; place-items: center; font-size: 44px; color: var(--dk); box-shadow: 0 0 0 4px var(--dk), 0 0 0 7px rgba(255,255,255,.25); }
#story-hud .sh-dialog.radio .face { width: 56px; height: 56px; font-size: 30px; left: 16px; top: 16px; }
#story-hud .sh-dialog.radio .face::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; border: 3px dashed rgba(255,255,255,.35); animation: sh-spin 6s linear infinite; }
#story-hud .sh-dialog .txt { font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 19px; line-height: 1.4; min-height: 54px; }
#story-hud .sh-dialog.radio .txt { font-size: 15.5px; min-height: 0; }
#story-hud .sh-dialog .txt b { color: #ffd21a; font-weight: 900; }
#story-hud .sh-dialog .nxt { position: absolute; right: 22px; bottom: 12px; font-size: 13px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; color: #a9a3c9; opacity: 0; }
#story-hud .sh-dialog.done .nxt { opacity: 1; animation: sh-blink 1s steps(2) infinite; }
#story-hud .sh-dialog.radio .nxt { display: none; }
#story-hud .sh-cover { inset: 0; display: grid; place-items: center; align-content: center; gap: 10px; background: rgba(13,11,24,.32); opacity: 0; transition: opacity .2s; }
#story-hud .sh-cover.on { opacity: 1; }
#story-hud .sh-cover div { font-size: 34px; -webkit-text-stroke: 5px var(--dk); paint-order: stroke fill; }
#story-hud .sh-cover small { font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 14px; background: rgba(27,21,48,.85); padding: 6px 14px; border-radius: 999px; }
#story-hud .sh-clear { inset: 0; display: grid; place-items: center; background: radial-gradient(circle at 50% 45%, rgba(27,21,48,.35), rgba(13,11,24,.82)); opacity: 0; transition: opacity .4s; }
#story-hud .sh-clear.on { opacity: 1; pointer-events: all; }
#story-hud .sh-clear .card { background: rgba(27,21,48,.95); border-radius: 28px; padding: 22px 28px 18px; width: min(580px, 92vw); max-height: 96vh; overflow: auto; text-align: center; box-shadow: 0 24px 70px rgba(0,0,0,.55), inset 0 0 0 3px rgba(255,255,255,.1); transform: translateY(20px) scale(.96); transition: transform .5s cubic-bezier(.2,1.5,.4,1); }
#story-hud .sh-clear.on .card { transform: none; }
#story-hud .sh-clear h1 { margin: 0; font-weight: 400; font-size: clamp(28px, 4.4vw, 46px); line-height: 1.05; letter-spacing: 1px; }
#story-hud .sh-clear h1 .w { white-space: nowrap; display: inline-block; margin: 0 .14em; }
#story-hud .sh-clear h1 span { display: inline-block; color: var(--c); -webkit-text-stroke: 6px var(--dk); paint-order: stroke fill; text-shadow: 0 6px 0 var(--dk); animation: sh-letter 2s ease-in-out infinite; animation-delay: calc(var(--i) * .07s); }
#story-hud .sh-clear .core { margin: 10px auto 2px; display: inline-flex; align-items: center; gap: 10px; font-size: 24px; }
#story-hud .sh-clear .core i { width: 22px; height: 34px; background: var(--cc); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); filter: drop-shadow(0 0 8px var(--cc)); }
#story-hud .sh-clear .rows { display: grid; gap: 5px; margin: 10px 0 16px; text-align: left; }
#story-hud .sh-clear .rows div { display: flex; justify-content: space-between; gap: 12px; background: rgba(255,255,255,.06); border-radius: 12px; padding: 6px 14px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 15px; color: #c9c2ff; }
#story-hud .sh-clear .rows b { font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 18px; color: #fff; }
#story-hud .sh-clear .rows b.gold { color: #ffd21a; }
#story-hud .sh-clear .hint { margin-top: 10px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 12px; color: #a9a3c9; }

#story-hud .sh-pill .gem { color: #9ff4ff; text-shadow: 0 0 8px rgba(95,216,255,.7); }
#story-hud .sh-shards.pop { animation: sh-pop .3s cubic-bezier(.2,1.8,.4,1); }
#story-hud .sh-sw b.cnt { font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 15px; color: #ffd21a; margin-left: 4px; }
#story-hud .sh-timer { left: 50%; top: 64px; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .2s; }
#story-hud .sh-timer.on { opacity: 1; }
#story-hud .sh-timer .n { font-size: 46px; line-height: 1; -webkit-text-stroke: 6px var(--dk); paint-order: stroke fill; color: #ffd21a; }
#story-hud .sh-timer.hot .n { color: #ff5d5d; animation: sh-throb2 .5s ease-in-out infinite alternate; }
#story-hud .sh-timer small { display: block; font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 12px; letter-spacing: 1px; text-shadow: 0 2px 0 var(--dk); }
#story-hud .sh-ov { inset: 0; display: grid; place-items: center; background: radial-gradient(circle at 50% 45%, rgba(27,21,48,.45), rgba(13,11,24,.86)); opacity: 0; transition: opacity .25s; pointer-events: none; }
#story-hud .sh-ov.on { opacity: 1; pointer-events: all; }
#story-hud .sh-ov .card { background: rgba(27,21,48,.96); border-radius: 26px; padding: 20px 24px 16px; width: min(760px, 94vw); max-height: 92vh; overflow: auto; box-shadow: 0 24px 70px rgba(0,0,0,.55), inset 0 0 0 3px rgba(255,255,255,.1); }
#story-hud .sh-ov h2 { margin: 0 0 4px; font-weight: 400; font-size: 32px; letter-spacing: 1px; text-align: center; -webkit-text-stroke: 5px var(--dk); paint-order: stroke fill; }
#story-hud .sh-ov .sub { text-align: center; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 14px; color: #c9c2ff; margin-bottom: 12px; }
#story-hud .sh-ov .sub b { color: #9ff4ff; font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 18px; }
#story-hud .sh-ov .hint { margin-top: 10px; text-align: center; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 12px; color: #a9a3c9; }
#story-hud .sh-shop .rows { display: grid; gap: 8px; }
#story-hud .sh-shop .row { display: grid; grid-template-columns: 46px 1fr auto; gap: 12px; align-items: center; background: rgba(255,255,255,.05); border-radius: 16px; padding: 9px 12px; box-shadow: inset 0 0 0 2px transparent; cursor: pointer; transition: background .15s, box-shadow .15s; }
#story-hud .sh-shop .row.sel { background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 2px var(--uc); }
#story-hud .sh-shop .ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 26px; background: var(--uc); color: var(--dk); box-shadow: 0 3px 0 rgba(0,0,0,.35); }
#story-hud .sh-shop .nm { font-size: 19px; letter-spacing: .3px; }
#story-hud .sh-shop .pips { display: inline-flex; gap: 4px; margin-left: 8px; vertical-align: middle; }
#story-hud .sh-shop .pips i { width: 14px; height: 14px; border-radius: 4px; background: rgba(255,255,255,.14); }
#story-hud .sh-shop .pips i.on { background: var(--uc); box-shadow: 0 0 8px var(--uc); }
#story-hud .sh-shop .ds { font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 13.5px; color: #d6d0ff; margin-top: 2px; }
#story-hud .sh-shop .ds em { font-style: normal; color: #a9a3c9; }
#story-hud .sh-shop .buy { min-width: 96px; padding: 9px 12px; border: 0; border-radius: 14px; font-family: var(--hfont, sans-serif); font-size: 17px; background: #9ff4ff; color: var(--dk); box-shadow: 0 4px 0 #3c8fa8; cursor: pointer; }
#story-hud .sh-shop .buy:disabled { background: #3a3550; color: #8a84a8; box-shadow: 0 4px 0 #24203a; cursor: default; }
#story-hud .sh-shop .buy.max { background: #5ee05a; box-shadow: 0 4px 0 #2e8a2a; }
#story-hud .sh-shop .face { display: flex; align-items: center; gap: 12px; margin: 0 auto 10px; max-width: 560px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 14.5px; color: #e6e1ff; background: rgba(255,255,255,.05); padding: 8px 14px; border-radius: 14px; }
#story-hud .sh-shop .face span.b { flex: 0 0 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--fc, #ff8ccf); color: var(--dk); font-family: var(--hfont, sans-serif); font-size: 22px; }
#story-hud .sh-book .sectors { display: grid; gap: 12px; }
#story-hud .sh-book .sec h3 { margin: 0 0 6px; font-weight: 400; font-size: 18px; letter-spacing: .5px; color: var(--sc); }
#story-hud .sh-book .sec h3 small { font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 12px; color: #a9a3c9; margin-left: 8px; }
#story-hud .sh-book .lvls { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
#story-hud .sh-book .lv { background: rgba(255,255,255,.05); border-radius: 12px; padding: 7px 8px 8px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 11.5px; color: #c9c2ff; min-height: 92px; }
#story-hud .sh-book .lv.locked { opacity: .45; }
#story-hud .sh-book .lv .t { display: flex; align-items: center; gap: 5px; color: #fff; font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 13px; line-height: 1.1; min-height: 30px; }
#story-hud .sh-book .lv .t i { flex: 0 0 12px; height: 18px; background: var(--cc); clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); opacity: .25; }
#story-hud .sh-book .lv.done .t i { opacity: 1; filter: drop-shadow(0 0 5px var(--cc)); }
#story-hud .sh-book .sws { display: flex; gap: 5px; margin-top: 6px; }
#story-hud .sh-book .sw { width: 22px; height: 32px; border-radius: 4px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 2px rgba(255,255,255,.18); position: relative; }
#story-hud .sh-book .sw.got { background: linear-gradient(#fff 0 14%, var(--a) 14% 42%, var(--b) 42% 70%, var(--c) 70%); box-shadow: 0 0 0 2px var(--dk); }
#story-hud .sh-book .sw:hover::after { content: attr(data-n); position: absolute; left: 50%; bottom: 110%; transform: translateX(-50%); white-space: nowrap; background: var(--dk); color: #fff; padding: 3px 8px; border-radius: 8px; font-size: 11px; z-index: 2; }
#story-hud .sh-book .lv .sh { margin-top: 5px; color: #9ff4ff; }
#story-hud .sh-book .tot { display: flex; justify-content: center; gap: 18px; margin-top: 12px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 900; font-size: 14px; color: #e6e1ff; }
#story-hud .sh-book .tot b { font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 20px; color: #ffd21a; }
#story-hud .sh-credits .card { text-align: center; width: min(620px, 94vw); }
#story-hud .sh-credits h1 { margin: 0; font-weight: 400; font-size: clamp(30px, 5vw, 54px); letter-spacing: 1px; }
#story-hud .sh-credits h1 span { display: inline-block; -webkit-text-stroke: 6px var(--dk); paint-order: stroke fill; text-shadow: 0 6px 0 var(--dk); animation: sh-letter 2s ease-in-out infinite; animation-delay: calc(var(--i) * .07s); }
#story-hud .sh-credits .roll { margin: 12px 0; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 15px; color: #d6d0ff; line-height: 1.55; }
#story-hud .sh-credits .roll b { color: #ffd21a; font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 17px; }
#story-hud .sh-credits .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; }
#story-hud .sh-credits .stats div { background: rgba(255,255,255,.06); border-radius: 12px; padding: 8px; font-family: var(--bfont, Nunito, sans-serif); font-weight: 800; font-size: 12px; color: #c9c2ff; }
#story-hud .sh-credits .stats b { display: block; font-family: var(--hfont, sans-serif); font-weight: 400; font-size: 22px; color: #fff; }
#story-hud .btn { pointer-events: all; }
@keyframes sh-blink { 50% { opacity: .25; } }
@keyframes sh-throb2 { to { transform: scale(1.12); } }
@keyframes sh-pop { from { transform: scale(.5); } to { transform: none; } }
@keyframes sh-spin { to { transform: rotate(360deg); } }
@keyframes sh-throb { to { transform: translateX(-50%) scale(1.05); } }
@keyframes sh-letter { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-6px) rotate(-3deg); } }
@keyframes sh-hurt { 0% { opacity: .9; transform: translate(-50%, -50%) rotate(var(--r)) scale(calc(var(--s) * .5)); } 15% { opacity: .85; transform: translate(-50%, -50%) rotate(var(--r)) scale(var(--s)); } 100% { opacity: 0; transform: translate(-50%, -38%) rotate(var(--r)) scale(var(--s)); } }
@media (max-width: 760px) { #story-hud .sh-card { min-width: 0; } #story-hud .sh-dialog .box { padding-left: 24px; padding-top: 30px; } #story-hud .sh-dialog .face { display: none; } #story-hud .sh-dialog .who { left: 20px; } }
`;

const HTML = `
  <div class="sh-hurt"></div>
  <div class="sh-card"><div class="sh-level"><span class="sh-num"></span><span class="sh-name"></span></div><div class="sh-obj"></div></div>
  <div class="sh-right">
    <div class="sh-pill sh-sw"><i></i><span>LOST SWATCH<small></small></span></div>
    <div class="sh-pill sh-shards" title="Hue Shards"><span class="gem">◆</span><span class="n">0</span></div>
    <div class="sh-pill sh-coins"><span class="coin">◉</span><span class="n">0</span></div>
  </div>
  <div class="sh-vitals"><div class="sh-bar sh-hp"><b>♥</b><div><i></i></div></div><div class="sh-bar sh-ink"><b>▼</b><div><i></i></div></div></div>
  <div class="sh-ret"><svg viewBox="-35 -35 70 70"><path class="hit" d="M-17 -17 L-9 -9 M17 -17 L9 -9 M-17 17 L-9 9 M17 17 L9 9"/></svg></div>
  <div class="sh-boss"><div class="nm"></div><div class="bar"><u></u><i></i></div><div class="ph"></div></div>
  <div class="sh-warn"></div>
  <div class="sh-timer"><div class="n"></div><small></small></div>
  <div class="sh-banner"><div class="m"></div><div class="s"></div></div>
  <div class="sh-splat"><div class="t">SPLASHED!</div><div class="u">Back to the last checkpoint…</div></div>
  <div class="sh-tip"></div>
  <div class="sh-prompt"></div>
  <div class="sh-toast"></div>
  <div class="sh-cover"><div>CLICK TO PLAY</div><small>WASD move · SHIFT swim · SPACE jump · LMB paint · E interact · ESC menu</small></div>
  <div class="sh-dialog"><div class="box"><div class="face"></div><div class="who"></div><div class="txt"></div><div class="nxt">▼ E / SPACE / CLICK</div></div></div>
  <div class="sh-clear"><div class="card"></div></div>
  <div class="sh-ov sh-shop"><div class="card"></div></div>
  <div class="sh-ov sh-book"><div class="card"></div></div>
  <div class="sh-ov sh-credits"><div class="card"></div></div>
`;

const RAINBOW = ['#ff3d7f', '#ffc83d', '#5ee05a', '#22d3ee', '#b06bff'];

export class StoryHUD {
  constructor(app) {
    this.app = app;
    this.style = document.createElement('style');
    this.style.id = 'story-style';
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    const root = this.root = document.createElement('div');
    root.id = 'story-hud';
    root.innerHTML = HTML;
    document.body.appendChild(root);
    const $ = (s) => root.querySelector(s);
    this.el = {
      card: $('.sh-card'), num: $('.sh-num'), name: $('.sh-name'), obj: $('.sh-obj'),
      sw: $('.sh-sw'), swName: $('.sh-sw small'), coins: $('.sh-coins .n'), right: $('.sh-right'),
      vitals: $('.sh-vitals'), hp: $('.sh-hp i'), ink: $('.sh-ink i'), ret: $('.sh-ret'),
      boss: $('.sh-boss'), bossName: $('.sh-boss .nm'), bossBar: $('.sh-boss .bar i'), bossLag: $('.sh-boss .bar u'), bossPh: $('.sh-boss .ph'), bossTrack: $('.sh-boss .bar'),
      warn: $('.sh-warn'), banner: $('.sh-banner'), bm: $('.sh-banner .m'), bs: $('.sh-banner .s'), splat: $('.sh-splat'), splatU: $('.sh-splat .u'),
      tip: $('.sh-tip'), prompt: $('.sh-prompt'), toast: $('.sh-toast'), cover: $('.sh-cover'), hurt: $('.sh-hurt'),
      dlg: $('.sh-dialog'), face: $('.sh-dialog .face'), who: $('.sh-dialog .who'), txt: $('.sh-dialog .txt'),
      clear: $('.sh-clear'), clearCard: $('.sh-clear .card'),
      shards: $('.sh-shards .n'), shardsPill: $('.sh-shards'), timer: $('.sh-timer'), timerN: $('.sh-timer .n'), timerL: $('.sh-timer small'),
      shop: $('.sh-shop'), shopCard: $('.sh-shop .card'), book: $('.sh-book'), bookCard: $('.sh-book .card'), credits: $('.sh-credits'), creditsCard: $('.sh-credits .card'),
    };
    this.cache = {};
    this.t = { toast: 0, banner: 0, warn: 0, hit: 0, tipHold: 0 };
    this.dlg = null;
    this.blipN = 0;
    this.tipsShown = new Set();
    this.shopSel = 0;
  }

  set(key, el, html) { if (this.cache[key] !== html) { this.cache[key] = html; el.innerHTML = html; } }
  cls(el, c, on) { if (el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); }

  setInk(css) { this.root.style.setProperty('--pc', css); }
  setLevel(num, name, color) {
    this.el.num.textContent = num;
    this.el.name.textContent = name;
    this.el.card.style.setProperty('--lc', color || 'var(--pc)');
  }
  objective(html) { this.set('obj', this.el.obj, html); }
  coins(n) { this.set('coins', this.el.coins, Number(n).toLocaleString()); }
  // level: Lost Swatches found here (n of total); hub: overall count
  swatches(n, total, colors, label = 'LOST SWATCHES') {
    this.el.sw.style.display = '';
    const key = `${n}/${total}/${label}`;
    if (this.cache.sw === key) return;
    const grew = this.cache.swN != null && n > this.cache.swN;
    this.cache.sw = key; this.cache.swN = n;
    this.cls(this.el.sw, 'found', n > 0);
    (colors || ['#ffd21a', '#ff3d7f', '#22d3ee']).forEach((c, i) => this.el.sw.style.setProperty(`--s${i + 1}`, c));
    this.el.sw.querySelector('span').firstChild.textContent = label;
    this.el.swName.innerHTML = `${n} / ${total} found`;
    if (grew) { this.el.sw.style.animation = 'none'; void this.el.sw.offsetWidth; this.el.sw.style.animation = ''; }
  }
  swatch(state, info) { this.swatches(state === 'found' ? 1 : 0, 1, info?.swatchColors); }
  swatchCount(n, total) { this.swatches(n, total, null); }
  shards(n, pop = false) {
    this.set('shards', this.el.shards, Number(n).toLocaleString());
    if (pop) { const e = this.el.shardsPill; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
  }
  timer(t, label) {
    if (t == null) { this.cls(this.el.timer, 'on', false); return; }
    this.cls(this.el.timer, 'on', true);
    this.set('timerN', this.el.timerN, Math.ceil(t).toString());
    this.set('timerL', this.el.timerL, label ? `${label.toUpperCase()}` : 'HURRY!');
    this.cls(this.el.timer, 'hot', t < 4);
  }
  // a tip shown once per visit (toast-style)
  tipOnce(key, html, t = 3.4) {
    if (this.tipsShown.has(key)) return;
    this.tipsShown.add(key);
    this.toast(html, t);
  }

  vitals(p) {
    const hp = Math.max(0, Math.round(p.hp)), ink = Math.max(0, Math.min(1, p.ink));
    this.el.hp.style.width = `${hp}%`;
    this.el.ink.style.width = `${Math.round(ink * 100)}%`;
    this.cls(this.el.vitals, 'low', ink < 0.18);
    this.cls(this.el.vitals, 'hurt', hp < 35 && p.alive);
  }
  reticle(on, goo, target) {
    this.cls(this.el.ret, 'on', on);
    this.cls(this.el.ret, 'goo', goo);
    this.cls(this.el.ret, 'target', !!target);
  }
  hit(kind = 'hit') {
    const r = this.el.ret;
    r.classList.remove('hit', 'kill', 'block');
    r.classList.add(kind);
    this.t.hit = kind === 'kill' ? 0.35 : 0.14;
  }
  hurt() {
    const n = document.createElement('div');
    n.style.left = `${15 + Math.random() * 70}%`;
    n.style.top = `${15 + Math.random() * 70}%`;
    n.style.setProperty('--r', `${Math.random() * 360}deg`);
    n.style.setProperty('--s', (0.6 + Math.random() * 0.6).toFixed(2));
    n.innerHTML = `<svg viewBox="0 0 100 100"><path d="${SPLAT}"/></svg>`;
    this.el.hurt.appendChild(n);
    while (this.el.hurt.children.length > 4) this.el.hurt.firstChild.remove();
    setTimeout(() => n.remove(), 1500);
  }
  toast(html, t = 2.6) { this.el.toast.innerHTML = html; this.cls(this.el.toast, 'on', true); this.t.toast = t; }
  banner(main, sub = '', t = 3, rainbow = false) {
    this.el.bm.innerHTML = rainbow ? [...main].map((ch, i) => `<span style="--i:${i};color:${RAINBOW[i % RAINBOW.length]}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('') : main;
    this.el.bs.innerHTML = sub;
    this.cls(this.el.banner, 'on', true);
    this.t.banner = t;
  }
  hideBanner() { this.t.banner = 0; this.cls(this.el.banner, 'on', false); }
  warn(html, t = 2) { this.el.warn.innerHTML = html; this.cls(this.el.warn, 'on', true); this.t.warn = t; }
  tip(html) {
    if (html) { this.set('tip', this.el.tip, html); this.t.tipHold = 0.6; this.cls(this.el.tip, 'on', true); }
  }
  prompt(html, key = 'E') {
    if (!html) { this.cls(this.el.prompt, 'on', false); return; }
    this.set('prompt', this.el.prompt, `<span class="sh-key">${key}</span> ${html}`);
    this.cls(this.el.prompt, 'on', true);
  }
  splatted(on, text) { if (text) this.el.splatU.textContent = text; this.cls(this.el.splat, 'on', on); }
  cover(on) { this.cls(this.el.cover, 'on', on); }
  showPlay(on) {
    for (const k of ['card', 'right', 'vitals']) this.el[k].style.opacity = on ? '' : '0';
  }
  boss(on, name, marks = []) {
    this.cls(this.el.boss, 'on', on);
    this.cls(this.root, 'boss-on', on);
    if (name) {
      this.el.bossName.textContent = name;
      this.el.bossTrack.querySelectorAll('em').forEach((e) => e.remove());
      for (const m of marks) { const e = document.createElement('em'); e.style.left = `${(m * 100).toFixed(1)}%`; this.el.bossTrack.appendChild(e); }
    }
  }
  bossBar(frac, label) {
    const w = `${(Math.max(0, frac) * 100).toFixed(1)}%`;
    if (this.cache.bw !== w) { this.cache.bw = w; this.el.bossBar.style.width = w; this.el.bossLag.style.width = w; }
    this.set('bph', this.el.bossPh, label || '');
  }

  // ------------------------------------------------------------ dialogue
  // lines: [{ who, text, radio }]; blocking dialogs wait for input,
  // radio chatter auto-advances and leaves the player in control.
  dialog(lines, opts = {}) {
    if (!lines || !lines.length) { opts.onDone?.(); return; }
    const blocking = opts.blocking !== false;
    const cur = this.dlg;
    if (cur && (cur.blocking || !blocking) && cur.blocking === blocking && !opts.onDone) { cur.lines = [...cur.lines, ...lines]; return; }
    if (cur && cur.blocking && !blocking) { this.queued = [...(this.queued || []), ...lines]; return; }
    this.dlg = { lines: [...lines], i: -1, blocking, onDone: opts.onDone, auto: 0 };
    this.nextLine();
  }
  get dialogOpen() { return !!this.dlg; }
  get dialogBlocking() { return !!this.dlg && this.dlg.blocking; }
  nextLine() {
    const d = this.dlg;
    d.i++;
    if (d.i >= d.lines.length) {
      this.dlg = null;
      this.cls(this.el.dlg, 'on', false);
      d.onDone?.();
      if (!this.dlg && this.queued?.length) { const q = this.queued; this.queued = null; this.dialog(q, { blocking: false }); }
      return;
    }
    const L = d.lines[d.i];
    const sp = SPEAKERS[L.who] || SPEAKERS.veil;
    d.sp = sp;
    d.tokens = String(L.text).split(/(<[^>]+>)/);
    d.total = d.tokens.reduce((a, t) => a + (t.startsWith('<') ? 0 : t.length), 0);
    d.shown = 0;
    d.auto = 0;
    this.el.dlg.style.setProperty('--sc', sp.color);
    this.el.face.textContent = sp.badge;
    this.el.who.innerHTML = `${sp.name}${L.radio ? '<small>RADIO</small>' : ''}`;
    this.cls(this.el.dlg, 'radio', !!L.radio || !d.blocking);
    this.cls(this.el.dlg, 'done', false);
    this.cls(this.el.dlg, 'on', true);
    this.renderText();
  }
  renderText() {
    const d = this.dlg;
    let left = Math.floor(d.shown), out = '';
    for (const t of d.tokens) {
      if (t.startsWith('<')) { out += t; continue; }
      if (left <= 0) break;
      out += t.slice(0, left);
      left -= t.length;
    }
    this.el.txt.innerHTML = out;
  }
  advance() {
    const d = this.dlg;
    if (!d) return;
    if (d.shown < d.total) { d.shown = d.total; this.renderText(); this.cls(this.el.dlg, 'done', true); return; }
    this.app.audio?.sfx('ui_select', { volume: 0.4 });
    this.nextLine();
  }
  closeDialog() { if (this.dlg) { this.dlg = null; this.queued = null; this.cls(this.el.dlg, 'on', false); } }

  // ------------------------------------------------------------ level clear
  showClear(d, onContinue) {
    let k = 0;
    const letters = 'HUE CORE RECOVERED!'.split(' ').map((word) => `<span class="w">${[...word].map((ch) => `<span style="--i:${k};--c:${RAINBOW[k++ % RAINBOW.length]}">${ch}</span>`).join('')}</span>`).join('');
    this.el.clearCard.innerHTML = `
      <h1>${letters}</h1>
      <div class="core" style="--cc:${d.color}"><i></i>${d.core}</div>
      <div class="rows">
        <div><span>Level</span><b>${d.num} · ${d.name}</b></div>
        <div><span>Time</span><b>${d.time}</b></div>
        <div><span>Lost Swatches</span><b class="${d.swFound >= d.swTotal ? 'gold' : ''}">${d.swFound >= d.swTotal ? '◆ All ' + d.swTotal + ' found!' : `◇ ${d.swFound} / ${d.swTotal} (more hidden here…)`}</b></div>
        <div><span>Hue Shards</span><b class="gold">◆ +${d.shards}</b></div>
        <div><span>Splashes</span><b>${d.kills}</b></div>
        <div><span>Coins</span><b class="gold">${d.coins > 0 ? '+' + d.coins : 'Already claimed'}</b></div>
      </div>
      <button class="btn big" data-a="go">${d.cta || 'BACK TO THE HIDEOUT ▶'}</button>
      <div class="hint">Press E / Space / Enter or click</div>`;
    this.cls(this.el.clear, 'on', true);
    this.cls(this.el.banner, 'on', false);
    this.t.banner = 0;
    const btn = this.el.clearCard.querySelector('[data-a="go"]');
    btn.onclick = () => onContinue();
    this.clearOpen = true;
  }


  // ------------------------------------------------------------ upgrade shop
  // m: { shards, items: [{ id, name, icon, color, level, max, cost, next, blurb }], who: { name, badge, color, line } }
  openShop(m, h) {
    this.shopH = h;
    this.shopOpen = true;
    this.renderShop(m);
    this.cls(this.el.shop, 'on', true);
  }
  renderShop(m) {
    this.shopModel = m;
    this.shopSel = Math.max(0, Math.min(m.items.length - 1, this.shopSel));
    const rows = m.items.map((u, i) => {
      const maxed = u.level >= u.max;
      const can = !maxed && m.shards >= u.cost;
      const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < u.level ? 'on' : ''}"></i>`).join('');
      return `<div class="row ${i === this.shopSel ? 'sel' : ''}" data-i="${i}" style="--uc:${u.color}">
        <div class="ic">${u.icon}</div>
        <div><div class="nm">${u.name}<span class="pips">${pips}</span></div><div class="ds">${maxed ? 'Fully upgraded!' : u.next} <em>· ${u.blurb}</em></div></div>
        <button class="buy ${maxed ? 'max' : ''}" data-b="${i}" ${can ? '' : 'disabled'}>${maxed ? 'MAX ✓' : `◆ ${u.cost}`}</button>
      </div>`;
    }).join('');
    const who = m.who ? `<div class="face" style="--fc:${m.who.color}"><span class="b">${m.who.badge}</span><span>${m.who.line}</span></div>` : '';
    this.el.shopCard.innerHTML = `<h2>${m.title || 'UPGRADES'}</h2><div class="sub">Spend <b>◆ ${m.shards}</b> Hue Shards on story upgrades</div>${who}<div class="rows">${rows}</div><div class="hint">W/S or ↑/↓ to pick · E / Enter to buy · Esc / Q to close · or click</div>`;
    this.el.shopCard.querySelectorAll('.row').forEach((r) => { r.onmouseenter = () => { this.shopSel = +r.dataset.i; this.el.shopCard.querySelectorAll('.row').forEach((x) => x.classList.toggle('sel', x === r)); }; });
    this.el.shopCard.querySelectorAll('[data-b]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); this.shopSel = +b.dataset.b; this.shopH?.onBuy?.(m.items[this.shopSel].id); }; });
  }
  shopNav(d) {
    if (!this.shopModel) return;
    this.shopSel = (this.shopSel + d + this.shopModel.items.length) % this.shopModel.items.length;
    this.app.audio?.sfx('ui_move', { volume: 0.4 });
    this.renderShop(this.shopModel);
  }
  shopBuy() { const u = this.shopModel?.items[this.shopSel]; if (u) this.shopH?.onBuy?.(u.id); }
  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.cls(this.el.shop, 'on', false);
    const h = this.shopH; this.shopH = null;
    h?.onClose?.();
  }

  // ------------------------------------------------------------ swatch book
  // m: { sectors: [{ num, name, color, open, found, total, levels: [{ tag, name, color, done, open, swatches: [{ got, name, colors }], shards }] }], totals }
  openBook(m, onClose) {
    const secs = m.sectors.map((s) => `<div class="sec" style="--sc:${s.color}"><h3>SECTOR ${s.num} · ${s.name.toUpperCase()}<small>${s.open ? `${s.found} / ${s.total} swatches` : 'not yet reached'}</small></h3><div class="lvls">${s.levels.map((l) => `
      <div class="lv ${l.done ? 'done' : ''} ${l.open ? '' : 'locked'}" style="--cc:${l.color}">
        <div class="t"><i></i>${l.open ? `${l.tag} ${l.name}` : `${l.tag} ???`}</div>
        <div class="sws">${l.swatches.map((w) => `<span class="sw ${w.got ? 'got' : ''}" data-n="${w.got ? w.name : '???'}" style="--a:${w.colors[0]};--b:${w.colors[1]};--c:${w.colors[2]}"></span>`).join('')}</div>
        ${l.open ? `<div class="sh">◆ ${l.shards}</div>` : ''}
      </div>`).join('')}</div></div>`).join('');
    const t = m.totals;
    this.el.bookCard.innerHTML = `<h2>THE SWATCH BOOK</h2><div class="sub">The old crew's color samples, scattered through the Underside. Some are <b>well</b> hidden.</div>
      <div class="sectors">${secs}</div>
      <div class="tot"><span>Swatches <b>${t.swatches} / ${t.swatchTotal}</b></span><span>Hue Cores <b>${t.cores} / ${t.coreTotal}</b></span><span>Shards found <b>${t.shards}</b></span></div>
      <div class="hint">Esc / E / Q to close · or click</div>`;
    this.bookOpen = true;
    this.bookClose = onClose;
    this.cls(this.el.book, 'on', true);
    this.el.book.onclick = () => this.closeBook();
  }
  closeBook() {
    if (!this.bookOpen) return;
    this.bookOpen = false;
    this.cls(this.el.book, 'on', false);
    const f = this.bookClose; this.bookClose = null;
    f?.();
  }

  // ------------------------------------------------------------ credits
  showCredits(d, onDone) {
    let k = 0;
    const title = 'THE END'.split('').map((ch) => `<span style="--i:${k};color:${RAINBOW[k++ % RAINBOW.length]}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    this.el.creditsCard.innerHTML = `<h1>${title}</h1>
      <div class="roll">The Underside is colorful again, and Prism Plaza is brighter than ever.<br>
      <b>Captain Veil</b> is retiring. Again. Probably.<br><b>Agent Tint</b> runs the Chroma Guard now.<br><b>Dabble</b> is opening a second shop.<br>And somewhere up in his old manor, <b>Baron Grisaille</b> is learning to love pink.</div>
      <div class="stats"><div>Hue Cores<b>${d.cores}</b></div><div>Lost Swatches<b>${d.swatches}</b></div><div>Hue Shards<b>${d.shards}</b></div></div>
      <div class="roll" style="font-size:13px;color:#a9a3c9">CHROMA CLASH · Story Mode: The Underside<br>Thanks for playing!</div>
      <button class="btn big" data-a="go">KEEP PLAYING ▶</button>
      <div class="hint">Every Lost Swatch is still out there for the finding.</div>`;
    this.creditsOpen = true;
    this.cls(this.el.credits, 'on', true);
    this.el.creditsCard.querySelector('[data-a="go"]').onclick = () => this.closeCredits();
    this.creditsDone = onDone;
  }
  closeCredits() {
    if (!this.creditsOpen) return;
    this.creditsOpen = false;
    this.cls(this.el.credits, 'on', false);
    const f = this.creditsDone; this.creditsDone = null;
    f?.();
  }
  get overlayOpen() { return !!(this.shopOpen || this.bookOpen || this.creditsOpen); }

  // ------------------------------------------------------------ frame
  update(dt) {
    const T = this.t;
    if (T.toast > 0 && (T.toast -= dt) <= 0) this.cls(this.el.toast, 'on', false);
    if (T.banner > 0 && (T.banner -= dt) <= 0) this.cls(this.el.banner, 'on', false);
    if (T.warn > 0 && (T.warn -= dt) <= 0) this.cls(this.el.warn, 'on', false);
    if (T.hit > 0 && (T.hit -= dt) <= 0) this.el.ret.classList.remove('hit', 'kill', 'block');
    if (T.tipHold > 0 && (T.tipHold -= dt) <= 0) this.cls(this.el.tip, 'on', false);
    const d = this.dlg;
    if (d && d.shown < d.total) {
      const before = Math.floor(d.shown);
      d.shown = Math.min(d.total, d.shown + dt * 52);
      const after = Math.floor(d.shown);
      if (after !== before) {
        this.renderText();
        this.blipN += after - before;
        if (this.blipN >= 3) { this.blipN = 0; this.app.audio?.sfx('dialog_blip', { pitch: d.sp.pitch * (0.92 + Math.random() * 0.16), volume: 0.45 }); }
      }
      if (d.shown >= d.total) this.cls(this.el.dlg, 'done', true);
    } else if (d && !d.blocking) {
      d.auto += dt;
      if (d.auto > 2.2 + d.total * 0.018) this.nextLine();
    }
  }

  dispose() {
    this.root.remove();
    this.style.remove();
    this.dlg = null;
  }
}
