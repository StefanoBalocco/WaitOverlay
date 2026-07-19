import test from 'ava';
import { JSDOM } from 'jsdom';
import WaitOverlayOriginal from './WaitOverlay.js';
import WaitOverlayMinified from './WaitOverlay.min.js';
function _createEnv() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
        url: "http://localhost",
        pretendToBeVisual: true
    });
    const win = dom.window;
    const doc = win.document;
    const fetchState = new Map();
    win.fetch = (input) => {
        const url = "string" === typeof input ? input : input.toString();
        const entry = fetchState.get(url);
        if (entry) {
            return Promise.resolve(new Response(entry.body, { status: entry.status }));
        }
        return Promise.reject(new Error("fetch fail"));
    };
    const rafFrames = new Map();
    let counter = 0;
    win.requestAnimationFrame = (cb) => {
        counter++;
        const id = counter;
        rafFrames.set(id, { id, callback: cb });
        return id;
    };
    win.cancelAnimationFrame = (id) => {
        rafFrames.delete(id);
    };
    win.ResizeObserver = class {
        _cb;
        constructor(callback) {
            this._cb = callback;
        }
        observe(_target) {
            this._cb([{ target: _target }]);
        }
        disconnect() { }
    };
    return { dom, doc, rafFrames, fetchState };
}
function _applyEnv(env) {
    const win = env.dom.window;
    globalThis.window = win;
    globalThis.document = env.doc;
    globalThis.ResizeObserver = win.ResizeObserver;
    globalThis.requestAnimationFrame = win.requestAnimationFrame;
    globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
    globalThis.fetch = win.fetch;
    globalThis.HTMLElement = win.HTMLElement;
    globalThis.SVGElement = win.SVGElement;
    globalThis.structuredClone = structuredClone;
}
function _discoverInstanceSlot(cls) {
    let returnValue = '';
    const ownKeys = Object.getOwnPropertyNames(cls);
    const cL1 = ownKeys.length;
    for (let iL1 = 0; iL1 < cL1; iL1++) {
        const key = ownKeys[iL1];
        const value = cls[key];
        if ('function' !== typeof value && (undefined === value || null === value)) {
            if ('' !== returnValue) {
                throw new Error('_discoverInstanceSlot: multiple candidate slots found');
            }
            returnValue = key;
        }
    }
    if ('' === returnValue) {
        throw new Error('_discoverInstanceSlot: no candidate slot found');
    }
    return returnValue;
}
function _getWeakMap(instance) {
    for (const key of Reflect.ownKeys(instance)) {
        const val = instance[key];
        if (val instanceof WeakMap) {
            return val;
        }
    }
    return null;
}
function _getShowCountKey(state) {
    for (const key of Reflect.ownKeys(state)) {
        const val = state[key];
        if ("number" === typeof val && 0 <= val && val < 1000) {
            return key;
        }
    }
    return null;
}
function _getOverlayKey(state) {
    for (const key of Reflect.ownKeys(state)) {
        if (state[key] instanceof HTMLElement) {
            return key;
        }
    }
    return null;
}
function _resetEnv(cls, slot) {
    cls[slot] = null;
    cls.GetInstance();
}
function setDim(el, props) {
    for (const [k, v] of Object.entries(props)) {
        Object.defineProperty(el, k, { value: v, configurable: true });
    }
}
function makeContainer(doc, w, h) {
    const el = doc.createElement("div");
    el.style.position = "relative";
    doc.body.appendChild(el);
    setDim(el, { offsetWidth: w, offsetHeight: h, clientWidth: w, clientHeight: h });
    return el;
}
function runRAF(env) {
    for (const [id] of env.rafFrames) {
        const f = env.rafFrames.get(id);
        if (f) {
            env.rafFrames.delete(id);
            f.callback();
        }
    }
}
const targets = [
    { tag: '[WaitOverlay-original]', cls: WaitOverlayOriginal, slot: '_instance' },
    { tag: '[WaitOverlay-minified]', cls: WaitOverlayMinified, slot: _discoverInstanceSlot(WaitOverlayMinified) }
];
for (const target of targets) {
    const tag = target.tag;
    const cls = target.cls;
    const slot = target.slot;
    let prefix = '';
    prefix = tag + ' Singleton';
    test.serial(prefix + ': GetInstance returns same instance', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const a = cls.GetInstance();
        const b = cls.GetInstance();
        t.is(a, b);
    });
    test.serial(prefix + ': constructor injects keyframe styles into head', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const styles = env.doc.head.getElementsByTagName("style");
        t.true(0 < styles.length);
        const text = styles[styles.length - 1].textContent;
        t.true(text.includes("waitoverlay_animation__rotate_right"));
        t.true(text.includes("waitoverlay_animation__fadein"));
        t.true(text.includes("waitoverlay_animation__pulse"));
    });
    prefix = tag + ' Show';
    test.serial(prefix + ': creates default overlay', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show();
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': creates .waitoverlay on body', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': on custom container', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ image: { enabled: false } }, c);
        t.truthy(c.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': increments count without duplicating DOM', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ image: { enabled: false } });
        o.Show({ image: { enabled: false } });
        t.is(env.doc.body.querySelectorAll(".waitoverlay").length, 1);
    });
    test.serial(prefix + ': respects direction row', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ direction: "row", image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.is(el.style.flexDirection, "row");
    });
    test.serial(prefix + ': respects direction column (default)', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.is(el.style.flexDirection, "column");
    });
    test.serial(prefix + ': respects backgroundClass', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ backgroundClass: "bg", image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.true(el.classList.contains("bg"));
    });
    test.serial(prefix + ': sets background color when no class', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.truthy(el.style.background);
    });
    test.serial(prefix + ': respects zIndex', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ zIndex: 999, image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay").style.zIndex, "999");
    });
    test.serial(prefix + ': with zIndex undefined sets no z-index', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ zIndex: undefined, image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay").style.zIndex, "");
    });
    test.serial(prefix + ': whole-page overlay has position fixed', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay").style.position, "fixed");
    });
    test.serial(prefix + ': contained overlay has position absolute', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ image: { enabled: false } }, c);
        t.is(c.querySelector(".waitoverlay").style.position, "absolute");
    });
    prefix = tag + ' Image';
    test.serial(prefix + ': Show with image disabled produces no elements', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        t.is(env.doc.body.querySelectorAll(".waitoverlay_element").length, 0);
    });
    test.serial(prefix + ': Show with inline SVG inserts SVG element', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({});
        t.truthy(env.doc.body.querySelector(".waitoverlay_element svg"));
    });
    test.serial(prefix + ': Show SVG fill/stroke applied via inline', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { color: { fill: "#ff0000", stroke: "#00ff00" }, class: "" } });
        const svg = env.doc.body.querySelector(".waitoverlay_element svg");
        t.truthy(svg);
        const circle = svg.querySelector("circle");
        t.truthy(circle);
        t.is(circle.style.fill, "#ff0000");
        t.is(circle.style.stroke, "#00ff00");
    });
    test.serial(prefix + ': Show with SVG fill+class skips color styling', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { color: { fill: "#ff0000" }, class: "img-cls" } });
        const el = env.doc.body.querySelector(".waitoverlay_element");
        t.truthy(el);
        t.true(el.classList.contains("img-cls"));
    });
    test.serial(prefix + ': Show with raster image sets backgroundImage', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { value: "http://x.com/p.png" } });
        const el = env.doc.body.querySelector(".waitoverlay_element");
        t.truthy(el);
        t.true(el.style.backgroundImage.includes("p.png"));
    });
    test.serial(prefix + ': Show with image class applies class', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { class: "ic" } });
        t.true(env.doc.body.querySelector(".waitoverlay_element").classList.contains("ic"));
    });
    test.serial(prefix + ': Show with remote SVG fetch', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        env.fetchState.set("http://x.com/s.svg", { status: 200, body: "<svg xmlns='http://www.w3.org/2000/svg'><circle r='5'/></svg>" });
        cls.GetInstance().Show({ image: { value: "http://x.com/s.svg" } });
        t.truthy(env.doc.body.querySelector(".waitoverlay_element"));
        await new Promise((r) => setTimeout(r, 60));
        const svg = env.doc.body.querySelector(".waitoverlay_element svg");
        t.truthy(svg, "SVG should be present after fetch resolves");
    });
    test.serial(prefix + ': Show with data URI SVG fetch', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        env.fetchState.set("data:image/svg+xml;utf8,<svg></svg>", { status: 200, body: "<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>" });
        cls.GetInstance().Show({ image: { value: "data:image/svg+xml;utf8,<svg></svg>" } });
        await new Promise((r) => setTimeout(r, 60));
        t.truthy(env.doc.body.querySelector(".waitoverlay_element svg"), "Data URI SVG should load");
    });
    test.serial(prefix + ': Show failed SVG fetch is silently swallowed', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { value: "http://x.com/missing.svg" } });
        t.truthy(env.doc.body.querySelector(".waitoverlay_element"));
        await new Promise((r) => setTimeout(r, 60));
        t.falsy(env.doc.body.querySelector(".waitoverlay_element svg"), "Failed fetch should not insert SVG");
    });
    prefix = tag + ' Animations';
    test.serial(prefix + ': Show with invalid animation name is reset to empty', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { animation: { name: "bogus", time: "500ms" } } });
        t.is(env.doc.body.querySelector(".waitoverlay_element").style.animationName, "");
    });
    test.serial(prefix + ': Show with valid animation pulse 1s applies animation', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { animation: { name: "pulse", time: "1s" } } });
        const el = env.doc.body.querySelector(".waitoverlay_element");
        t.is(el.style.animationName, "waitoverlay_animation__pulse");
        t.is(el.style.animationDuration, "1s");
    });
    test.serial(prefix + ': Show with valid name but empty time applies no animation', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { animation: { name: "fadein", time: "" } } });
        const el = env.doc.body.querySelector(".waitoverlay_element");
        t.is(el.style.animationName, "");
    });
    test.serial(prefix + ': Show with valid name but invalid time applies no animation', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { animation: { name: "pulse", time: "500" } } });
        const el = env.doc.body.querySelector(".waitoverlay_element");
        t.is(el.style.animationName, "");
    });
    prefix = tag + ' Custom HTML';
    test.serial(prefix + ': enabled inserts content', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ custom: { enabled: true, value: "<b>hi</b>" }, image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay_element b"));
    });
    test.serial(prefix + ': disabled produces no element', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        t.is(env.doc.body.querySelectorAll(".waitoverlay_element").length, 0);
    });
    prefix = tag + ' Configure';
    test.serial(prefix + ': merges settings and Show applies them', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Configure({ background: "red" });
        o.Show({ image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay").style.background, "red");
    });
    test.serial(prefix + ': with array replaces entire array', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Configure({ fade: [1, 2] });
        o.Show({ image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.true(0 < env.rafFrames.size, "fade[0]=1 should queue a RAF");
    });
    test.serial(prefix + ': with null source is a no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Configure(null);
        o.Show({ image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
    });
    prefix = tag + ' Text';
    test.serial(prefix + ': enabled shows content', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ text: { enabled: true, value: "hi" }, image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay_text").textContent, "hi");
    });
    test.serial(prefix + ': with class applies class', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ text: { enabled: true, value: "t", class: "tc" }, image: { enabled: false } });
        t.true(env.doc.body.querySelector(".waitoverlay_text").classList.contains("tc"));
    });
    test.serial(prefix + ': with color sets color', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ text: { enabled: true, value: "t", class: "", color: "blue" }, image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay_text");
        t.truthy(el.style.color);
    });
    test.serial(prefix + ': method updates and hides', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ text: { enabled: true, value: "a" }, image: { enabled: false } });
        o.Text("b");
        t.is(env.doc.body.querySelector(".waitoverlay_text").textContent, "b");
        o.Text(false);
        t.is(env.doc.body.querySelector(".waitoverlay_text").style.display, "none");
    });
    test.serial(prefix + ': method on absent state is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Text("x");
        t.falsy(env.doc.body.querySelector(".waitoverlay_text"));
    });
    test.serial(prefix + ': method on overlay without text is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ image: { enabled: false } });
        o.Text("x");
        t.falsy(env.doc.body.querySelector(".waitoverlay_text"));
    });
    prefix = tag + ' Progress';
    test.serial(prefix + ': enabled creates .waitoverlay_progress', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true }, image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay_progress"));
    });
    test.serial(prefix + ': disabled produces no progress element', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false } });
        t.falsy(env.doc.body.querySelector(".waitoverlay_progress"));
    });
    test.serial(prefix + ': with position top sets margin', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true, position: "top", margin: "5px" }, image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay_progress").style.top, "5px");
    });
    test.serial(prefix + ': with position bottom sets bottom', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true, position: "bottom", margin: "5px" }, image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay_progress");
        t.is(el.style.top, "auto");
        t.is(el.style.bottom, "5px");
    });
    test.serial(prefix + ': with position invalid uses default (empty)', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true, position: "invalid", margin: "10px" }, image: { enabled: false } });
        const el = env.doc.body.querySelector(".waitoverlay_progress");
        t.not(el.style.top, "10px");
    });
    test.serial(prefix + ': with class applies to bar', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true, class: "pc" }, image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay_progress .pc"));
    });
    test.serial(prefix + ': with color (no class) sets bar background', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ progress: { enabled: true, class: "", color: "red" }, image: { enabled: false } });
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.truthy(bar);
        t.is(bar.style.background, "red");
    });
    prefix = tag + ' Progress method';
    test.serial(prefix + ': sets bar width to 50%', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true }, image: { enabled: false } });
        o.Progress(50);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.truthy(bar);
        t.is(bar.style.width, "50%");
    });
    test.serial(prefix + ': NaN treated as 0', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true }, image: { enabled: false } });
        o.Progress(NaN);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.truthy(bar);
        t.is(bar.style.width, "0%");
    });
    test.serial(prefix + ': clamped to min', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true, min: 10, max: 100 }, image: { enabled: false } });
        o.Progress(5);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.is(bar.style.width, "0%");
    });
    test.serial(prefix + ': clamped to max', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true }, image: { enabled: false } });
        o.Progress(200);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.is(bar.style.width, "100%");
    });
    test.serial(prefix + ': with invalid min/max range does nothing', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true, min: 100, max: 0 }, image: { enabled: false } });
        o.Progress(50);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.is(bar.style.width, "");
    });
    test.serial(prefix + ': false hides bar', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ progress: { enabled: true }, image: { enabled: false } });
        o.Progress(false);
        const bar = env.doc.body.querySelector(".waitoverlay_progress").firstElementChild.firstElementChild;
        t.is(bar.style.display, "none");
    });
    test.serial(prefix + ': on absent state is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Progress(50);
        t.falsy(env.doc.body.querySelector(".waitoverlay_progress"));
    });
    test.serial(prefix + ': on overlay without progress is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ image: { enabled: false } });
        o.Progress(50);
        t.falsy(env.doc.body.querySelector(".waitoverlay_progress"));
    });
    prefix = tag + ' Fade';
    test.serial(prefix + ': queues RAF and applies opacity', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [100, 0], image: { enabled: false } });
        t.true(0 < env.rafFrames.size, "fade[0]=100 should queue a RAF");
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el);
        t.is(el.style.opacity, "0");
        runRAF(env);
        t.is(el.style.opacity, "1");
    });
    test.serial(prefix + ': Zero fade-in shows immediately', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ fade: [0, 0], image: { enabled: false } });
        t.is(env.doc.body.querySelector(".waitoverlay").style.opacity, "1");
    });
    prefix = tag + ' Hide';
    test.serial(prefix + ': on absent state is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Hide();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': decrements nested count — overlay stays', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Hide();
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': force removes overlay even with nested count', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Hide(true);
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': at zero count removes overlay', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Hide();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': with fade-out via transitionend removes overlay', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 100], image: { enabled: false } });
        o.Hide();
        const el = env.doc.body.querySelector(".waitoverlay");
        t.truthy(el, "overlay stays during fade-out");
        el.dispatchEvent(new env.dom.window.Event("transitionend"));
        t.falsy(env.doc.body.querySelector(".waitoverlay"), "overlay removed after transitionend");
    });
    test.serial(prefix + ': fade-out timer safety path', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 100], image: { enabled: false } });
        o.Hide();
        t.truthy(env.doc.body.querySelector(".waitoverlay"), "overlay visible during fade-out");
        await new Promise((r) => setTimeout(r, 200));
        t.falsy(env.doc.body.querySelector(".waitoverlay"), "overlay removed after timer");
    });
    test.serial(prefix + ': zero fade-out calls immediate cleanup', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Hide();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': Show after Hide creates fresh overlay', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Hide();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        t.is(env.doc.body.querySelectorAll(".waitoverlay").length, 1);
    });
    prefix = tag + ' Resize';
    test.serial(prefix + ': on absent state is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Resize();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': with overlay sets container-relative dimensions', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ image: { enabled: false } }, c);
        cls.GetInstance().Resize(c);
        t.is(c.querySelector(".waitoverlay").style.width, "200px");
    });
    test.serial(prefix + ': invisible container sets display none', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 0, 0);
        cls.GetInstance().Show({ image: { enabled: false } }, c);
        t.is(c.querySelector(".waitoverlay").style.display, "none");
    });
    test.serial(prefix + ': with explicit units applies correct size', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ size: { value: 40, units: "px" } }, c);
        t.is(c.querySelector(".waitoverlay_element").style.width, "40px");
    });
    test.serial(prefix + ': no autoresize skips element', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ image: { autoResize: false } }, c);
        cls.GetInstance().Resize(c);
        t.truthy(c.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': with size 0 skips element sizing', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({ size: { value: 0 } }, c);
        const el = c.querySelector(".waitoverlay_element");
        t.truthy(el);
        t.is(el.style.width, "");
    });
    test.serial(prefix + ': with resize disabled does not create observer', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ resize: false, image: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
    });
    prefix = tag + ' Destroy';
    test.serial(prefix + ': removes overlay from container', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        const o = cls.GetInstance();
        o.Show({ fade: [100, 100], image: { enabled: false } }, c);
        o.Destroy(c);
        t.falsy(c.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': on absent state is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Destroy();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': cancels queued RAF', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [100, 0], image: { enabled: false } });
        t.true(0 < env.rafFrames.size, "RAF queued after Show");
        o.Destroy();
        t.is(env.rafFrames.size, 0, "RAF cancelled after Destroy");
    });
    prefix = tag + ' Edge cases';
    test.serial(prefix + ': Show with all content disabled renders only the overlay shell', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        cls.GetInstance().Show({ image: { enabled: false }, custom: { enabled: false }, text: { enabled: false }, progress: { enabled: false } });
        t.truthy(env.doc.body.querySelector(".waitoverlay"));
        t.is(env.doc.body.querySelectorAll(".waitoverlay_element").length, 0);
    });
    test.serial(prefix + ': Hide after Destroy is no-op', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        o.Destroy();
        o.Hide();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    prefix = tag + ' Coverage edge cases';
    test.serial(prefix + ': Hide with negative showCount is clamped to 0', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        const wm = _getWeakMap(o);
        t.truthy(wm, "should find WeakMap on instance");
        const body = env.doc.body;
        const state = wm.get(body);
        t.truthy(state, "state should exist for body");
        const stateObj = state;
        const showCountKey = _getShowCountKey(stateObj);
        t.truthy(showCountKey, "should find showCount property");
        stateObj[showCountKey] = 0;
        o.Hide();
        const stateAfter = wm.get(body);
        t.falsy(stateAfter, "state should be cleaned up after Hide at count 0");
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': Hide with state but no overlay calls else cleanup', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ fade: [0, 0], image: { enabled: false } });
        const wm = _getWeakMap(o);
        t.truthy(wm);
        const body = env.doc.body;
        const state = wm.get(body);
        t.truthy(state);
        const stateObj = state;
        const overlayKey = _getOverlayKey(stateObj);
        t.truthy(overlayKey, "should find overlay HTMLElement property");
        const overlayEl = stateObj[overlayKey];
        t.truthy(overlayEl);
        overlayEl.remove();
        stateObj[overlayKey] = null;
        o.Hide();
        t.falsy(env.doc.body.querySelector(".waitoverlay"));
    });
    test.serial(prefix + ': Show with resize missing resizeFactor defaults to 1', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 100, 100);
        cls.GetInstance().Show({}, c);
        const els = c.querySelectorAll(".waitoverlay_element");
        t.true(0 < els.length);
        t.is(els[0].dataset.resizefactor, "1");
    });
    test.serial(prefix + ': Resize with missing resizeFactor falls back to 1', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({}, c);
        const el = c.querySelector(".waitoverlay_element");
        t.truthy(el);
        delete el.dataset.resizefactor;
        t.falsy(el.dataset.resizefactor, "resizefactor should be gone");
        cls.GetInstance().Resize(c);
        t.truthy(el.style.width);
    });
    test.serial(prefix + ': Second Show on null-overlay state re-merges settings', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const o = cls.GetInstance();
        o.Show({ image: { enabled: false } });
        const wm = _getWeakMap(o);
        t.truthy(wm);
        const state = wm.get(env.doc.body);
        t.truthy(state);
        const stateObj = state;
        const overlayKey = _getOverlayKey(stateObj);
        t.truthy(overlayKey);
        stateObj[overlayKey].remove();
        stateObj[overlayKey] = null;
        env.doc.body.innerHTML = "";
        o.Show({ backgroundClass: "fresh", image: { enabled: false } });
        const overlay = env.doc.body.querySelector(".waitoverlay");
        t.truthy(overlay, "new overlay created");
        t.true(overlay.classList.contains("fresh"), "fresh backgroundClass applied");
    });
    test.serial(prefix + ': Show with custom content and resize', async (t) => {
        const env = _createEnv();
        _applyEnv(env);
        _resetEnv(cls, slot);
        const c = makeContainer(env.doc, 200, 200);
        cls.GetInstance().Show({
            custom: { enabled: true, value: "<span>test</span>" },
            text: { enabled: true, value: "text" },
            progress: { enabled: true }
        }, c);
        t.truthy(c.querySelector(".waitoverlay_element span"));
        t.truthy(c.querySelector(".waitoverlay_text"));
        t.truthy(c.querySelector(".waitoverlay_progress"));
    });
}
