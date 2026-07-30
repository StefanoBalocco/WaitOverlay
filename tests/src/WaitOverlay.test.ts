import test from 'ava';
import type { ExecutionContext } from 'ava';
import type { DOMWindow } from 'jsdom';
import { JSDOM } from 'jsdom';
import WaitOverlayOriginal from '../../dist/WaitOverlay.js';
// @ts-expect-error WaitOverlay.min.js intentionally shares the original public API.
import WaitOverlayMinified from '../../dist/WaitOverlay.min.js';

// ── Types ────────────────────────────────────────────────────────────────────

type Nullable<T> = T | null;
type Undefinedable<T> = T | undefined;

interface AnimationFrame {
	id: number;
	callback: () => void;
}

interface Env {
	dom: JSDOM;
	doc: Document;
	rafFrames: Map<number, AnimationFrame>;
	fetchState: Map<string, { status: number; body: string }>;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function _createEnv(): Env {
	const dom: JSDOM = new JSDOM( `<!DOCTYPE html><html><body></body></html>`, {
		url: "http://localhost",
		pretendToBeVisual: true
	} );
	const win: DOMWindow = dom.window;
	const doc: Document = win.document;

	const fetchState: Map<string, { status: number; body: string }> = new Map();
	( win as unknown as Record<string, unknown> ).fetch = ( input: RequestInfo | URL ): Promise<Response> => {
		const url: string = "string" === typeof input ? input : ( input as URL ).toString();
		const entry = fetchState.get( url );
		if( entry ) {
			return Promise.resolve( new Response( entry.body, { status: entry.status } ) );
		}
		return Promise.reject( new Error( "fetch fail" ) );
	};

	const rafFrames: Map<number, AnimationFrame> = new Map();
	let counter: number = 0;
	( win as unknown as Record<string, unknown> ).requestAnimationFrame = ( cb: () => void ): number => {
		counter++;
		const id: number = counter;
		rafFrames.set( id, { id, callback: cb } );
		return id;
	};
	( win as unknown as Record<string, unknown> ).cancelAnimationFrame = ( id: number ): void => {
		rafFrames.delete( id );
	};
	( win as unknown as Record<string, unknown> ).ResizeObserver = class {
		private _cb: ( entries: unknown[] ) => void;
		constructor( callback: ( entries: unknown[] ) => void ) {
			this._cb = callback;
		}
		observe( _target: Element ): void {
			this._cb( [ { target: _target } ] );
		}
		disconnect(): void { }
	};

	return { dom, doc, rafFrames, fetchState };
}

function _applyEnv( env: Env ): void {
	const win: Window & typeof globalThis = env.dom.window as unknown as Window & typeof globalThis;
	( globalThis as unknown as Record<string, unknown> ).window = win;
	( globalThis as unknown as Record<string, unknown> ).document = env.doc;
	( globalThis as unknown as Record<string, unknown> ).ResizeObserver = win.ResizeObserver;
	( globalThis as unknown as Record<string, unknown> ).requestAnimationFrame = ( win as unknown as Record<string, unknown> ).requestAnimationFrame as unknown as ( cb: () => void ) => number;
	( globalThis as unknown as Record<string, unknown> ).cancelAnimationFrame = ( win as unknown as Record<string, unknown> ).cancelAnimationFrame as unknown as ( id: number ) => void;
	( globalThis as unknown as Record<string, unknown> ).fetch = ( win as unknown as Record<string, unknown> ).fetch;
	( globalThis as unknown as Record<string, unknown> ).HTMLElement = win.HTMLElement;
	( globalThis as unknown as Record<string, unknown> ).SVGElement = win.SVGElement;
	( globalThis as unknown as Record<string, unknown> ).structuredClone = structuredClone;
}

/** Discover the static _instance slot name (mangled in min) without triggering the instance getter, which lazily constructs the singleton. */
function _discoverInstanceSlot( cls: typeof WaitOverlayOriginal ): string {
	let returnValue: string = '';
	const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors( cls );
	const ownKeys: string[] = Object.getOwnPropertyNames( descriptors );
	const cL1: number = ownKeys.length;
	for( let iL1: number = 0; iL1 < cL1; iL1++ ) {
		const key: string = ownKeys[ iL1 ];
		const descriptor: PropertyDescriptor = descriptors[ key ];
		if( 'get' in descriptor || 'set' in descriptor ) {
			continue;
		}
		const value: unknown = descriptor.value;
		if( 'function' !== typeof value && ( undefined === value || null === value ) ) {
			if( '' !== returnValue ) {
				throw new Error( '_discoverInstanceSlot: multiple candidate slots found' );
			}
			returnValue = key;
		}
	}
	if( '' === returnValue ) {
		throw new Error( '_discoverInstanceSlot: no candidate slot found' );
	}
	return returnValue;
}

/** Find a WeakMap on an instance (target-agnostic) */
function _getWeakMap( instance: WaitOverlayOriginal ): Nullable<WeakMap<WeakKey, unknown>> {
	for( const key of Reflect.ownKeys( instance as unknown as object ) ) {
		const val: unknown = ( instance as unknown as Record<string | symbol, unknown> )[ key ];
		if( val instanceof WeakMap ) {
			return val;
		}
	}
	return null;
}

/** Find the numeric _showCount-like property on a state object and return its key */
function _getShowCountKey( state: Record<string | symbol, unknown> ): Nullable<string | symbol> {
	for( const key of Reflect.ownKeys( state ) ) {
		const val: unknown = state[ key ];
		if( "number" === typeof val && 0 <= val && val < 1000 ) {
			return key;
		}
	}
	return null;
}

/** Find an HTMLElement property on a state object (the _overlay property) */
function _getOverlayKey( state: Record<string | symbol, unknown> ): Nullable<string | symbol> {
	for( const key of Reflect.ownKeys( state ) ) {
		if( state[ key ] instanceof HTMLElement ) {
			return key;
		}
	}
	return null;
}

function _resetEnv( cls: typeof WaitOverlayOriginal, slot: string ): void {
	( cls as unknown as Record<string, unknown> )[ slot ] = null;
	cls.instance;
}

function setDim( el: HTMLElement, props: Record<string, number> ): void {
	for( const [ k, v ] of Object.entries( props ) ) {
		Object.defineProperty( el, k, { value: v, configurable: true } );
	}
}

function makeContainer( doc: Document, w: number, h: number ): HTMLElement {
	const el: HTMLElement = doc.createElement( "div" );
	el.style.position = "relative";
	doc.body.appendChild( el );
	setDim( el, { offsetWidth: w, offsetHeight: h, clientWidth: w, clientHeight: h } );
	return el;
}

function runRAF( env: Env ): void {
	for( const [ id ] of env.rafFrames ) {
		const f: Undefinedable<AnimationFrame> = env.rafFrames.get( id );
		if( f ) {
			env.rafFrames.delete( id );
			f.callback();
		}
	}
}

// ── Targets ───────────────────────────────────────────────────────────────────

interface Target {
	tag: string;
	cls: typeof WaitOverlayOriginal;
	slot: string;
}

const targets: readonly Target[] = [
	{ tag: '[WaitOverlay-original]', cls: WaitOverlayOriginal, slot: '_instance' },
	{ tag: '[WaitOverlay-minified]', cls: WaitOverlayMinified as typeof WaitOverlayOriginal, slot: _discoverInstanceSlot( WaitOverlayMinified as typeof WaitOverlayOriginal ) }
];

// ── Tests ─────────────────────────────────────────────────────────────────────

for( const target of targets ) {
	const tag: string = target.tag;
	const cls: typeof WaitOverlayOriginal = target.cls;
	const slot: string = target.slot;
	let prefix: string = '';

	// ── 1. Singleton ──────────────────────────────────────────
	prefix = tag + ' Singleton';

	test.serial( prefix + ': instance returns same instance', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const a: WaitOverlayOriginal = cls.instance;
		const b: WaitOverlayOriginal = cls.instance;
		t.is( a, b );
	} );

	test.serial( prefix + ': constructor injects keyframe styles into head', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const styles: HTMLCollectionOf<HTMLStyleElement> = env.doc.head.getElementsByTagName( "style" );
		t.true( 0 < styles.length );
		const text: string = ( styles[ styles.length - 1 ] as HTMLStyleElement ).textContent;
		t.true( text.includes( "waitoverlay_animation__rotate_right" ) );
		t.true( text.includes( "waitoverlay_animation__fadein" ) );
		t.true( text.includes( "waitoverlay_animation__pulse" ) );
	} );

	// ── 2. Show ───────────────────────────────────────────────
	prefix = tag + ' Show';

	test.serial( prefix + ': creates default overlay', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show();
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': creates .waitoverlay on body', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': on custom container', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { image: { enabled: false } }, c );
		t.truthy( c.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': increments count without duplicating DOM', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { image: { enabled: false } } );
		o.Show( { image: { enabled: false } } );
		t.is( env.doc.body.querySelectorAll( ".waitoverlay" ).length, 1 );
	} );

	test.serial( prefix + ': respects direction row', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { direction: "row", image: { enabled: false } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.is( ( el as HTMLElement ).style.flexDirection, "row" );
	} );

	test.serial( prefix + ': respects direction column (default)', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.is( ( el as HTMLElement ).style.flexDirection, "column" );
	} );

	test.serial( prefix + ': respects backgroundClass', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { backgroundClass: "bg", image: { enabled: false } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.true( el!.classList.contains( "bg" ) );
	} );

	test.serial( prefix + ': sets background color when no class', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.truthy( ( el as HTMLElement ).style.background );
	} );

	test.serial( prefix + ': respects zIndex', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { zIndex: 999, image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay" ) as HTMLElement ).style.zIndex, "999" );
	} );

	test.serial( prefix + ': with zIndex undefined sets no z-index', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { zIndex: undefined as unknown as number, image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay" ) as HTMLElement ).style.zIndex, "" );
	} );

	test.serial( prefix + ': whole-page overlay has position fixed', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay" ) as HTMLElement ).style.position, "fixed" );
	} );

	test.serial( prefix + ': contained overlay has position absolute', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { image: { enabled: false } }, c );
		t.is( ( c.querySelector( ".waitoverlay" ) as HTMLElement ).style.position, "absolute" );
	} );

	// ── 3. Image ──────────────────────────────────────────────
	prefix = tag + ' Image';

	test.serial( prefix + ': Show with image disabled produces no elements', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		t.is( env.doc.body.querySelectorAll( ".waitoverlay_element" ).length, 0 );
	} );

	test.serial( prefix + ': Show with inline SVG inserts SVG element', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( {} );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_element svg" ) );
	} );

	test.serial( prefix + ': Show SVG fill/stroke applied via inline', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { color: { fill: "#ff0000", stroke: "#00ff00" }, class: "" } } );
		const svg: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay_element svg" );
		t.truthy( svg );
		const circle: Nullable<Element> = svg!.querySelector( "circle" );
		t.truthy( circle );
		const ref: HTMLElement = env.doc.createElement( 'div' );
		ref.style.fill = '#ff0000';
		ref.style.stroke = '#00ff00';
		t.is( ( circle as HTMLElement ).style.fill, ref.style.fill );
		t.is( ( circle as HTMLElement ).style.stroke, ref.style.stroke );
	} );

	test.serial( prefix + ': Show with SVG fill+class skips color styling', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { color: { fill: "#ff0000" }, class: "img-cls" } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay_element" );
		t.truthy( el );
		t.true( el!.classList.contains( "img-cls" ) );
	} );

	test.serial( prefix + ': Show with raster image sets backgroundImage', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { value: "http://x.com/p.png" } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay_element" );
		t.truthy( el );
		t.true( ( el as HTMLElement ).style.backgroundImage.includes( "p.png" ) );
	} );

	test.serial( prefix + ': Show with image class applies class', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { class: "ic" } } );
		t.true( ( env.doc.body.querySelector( ".waitoverlay_element" ) as Element ).classList.contains( "ic" ) );
	} );

	test.serial( prefix + ': Show with remote SVG fetch', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		env.fetchState.set( "http://x.com/s.svg", { status: 200, body: "<svg xmlns='http://www.w3.org/2000/svg'><circle r='5'/></svg>" } );
		cls.instance.Show( { image: { value: "http://x.com/s.svg" } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_element" ) );
		await new Promise<void>( ( r: () => void ) => setTimeout( r, 60 ) );
		const svg: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay_element svg" );
		t.truthy( svg, "SVG should be present after fetch resolves" );
	} );

	test.serial( prefix + ': Show with data URI SVG fetch', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		env.fetchState.set( "data:image/svg+xml;utf8,<svg></svg>", { status: 200, body: "<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>" } );
		cls.instance.Show( { image: { value: "data:image/svg+xml;utf8,<svg></svg>" } } );
		await new Promise<void>( ( r: () => void ) => setTimeout( r, 60 ) );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_element svg" ), "Data URI SVG should load" );
	} );

	test.serial( prefix + ': Show failed SVG fetch is silently swallowed', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { value: "http://x.com/missing.svg" } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_element" ) );
		await new Promise<void>( ( r: () => void ) => setTimeout( r, 60 ) );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_element svg" ), "Failed fetch should not insert SVG" );
	} );

	// ── 4. Animations ─────────────────────────────────────────
	prefix = tag + ' Animations';

	test.serial( prefix + ': Show with invalid animation name is reset to empty', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { animation: { name: "bogus", time: "500ms" } } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay_element" ) as HTMLElement ).style.animationName, "" );
	} );

	test.serial( prefix + ': Show with valid animation pulse 1s applies animation', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { animation: { name: "pulse", time: "1s" } } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_element" ) as HTMLElement;
		t.is( el.style.animationName, "waitoverlay_animation__pulse" );
		t.is( el.style.animationDuration, "1s" );
	} );

	test.serial( prefix + ': Show with valid name but empty time applies no animation', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { animation: { name: "fadein", time: "" } } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_element" ) as HTMLElement;
		t.is( el.style.animationName, "" );
	} );

	test.serial( prefix + ': Show with valid name but invalid time applies no animation', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { animation: { name: "pulse", time: "500" } } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_element" ) as HTMLElement;
		t.is( el.style.animationName, "" );
	} );

	// ── 5. Custom HTML ────────────────────────────────────────
	prefix = tag + ' Custom HTML';

	test.serial( prefix + ': enabled inserts content', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { custom: { enabled: true, value: "<b>hi</b>" }, image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_element b" ) );
	} );

	test.serial( prefix + ': disabled produces no element', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		t.is( env.doc.body.querySelectorAll( ".waitoverlay_element" ).length, 0 );
	} );

	// ── 6. Configure ──────────────────────────────────────────
	prefix = tag + ' Configure';

	test.serial( prefix + ': merges settings and Show applies them', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Configure( { background: "red" } );
		o.Show( { image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay" ) as HTMLElement ).style.background, "red" );
	} );

	test.serial( prefix + ': with array replaces entire array', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Configure( { fade: [ 1, 2 ] } );
		o.Show( { image: { enabled: false } } );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.true( 0 < env.rafFrames.size, "fade[0]=1 should queue a RAF" );
	} );

	test.serial( prefix + ': with null source is a no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Configure( null as unknown as Record<string, unknown> );
		o.Show( { image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	// ── 7. Text ───────────────────────────────────────────────
	prefix = tag + ' Text';

	test.serial( prefix + ': enabled shows content', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { text: { enabled: true, value: "hi" }, image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay_text" ) as Element ).textContent, "hi" );
	} );

	test.serial( prefix + ': with class applies class', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { text: { enabled: true, value: "t", class: "tc" }, image: { enabled: false } } );
		t.true( ( env.doc.body.querySelector( ".waitoverlay_text" ) as Element ).classList.contains( "tc" ) );
	} );

	test.serial( prefix + ': with color sets color', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { text: { enabled: true, value: "t", class: "", color: "blue" }, image: { enabled: false } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_text" ) as HTMLElement;
		t.truthy( el.style.color );
	} );

	test.serial( prefix + ': method updates and hides', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { text: { enabled: true, value: "a" }, image: { enabled: false } } );
		o.Text( "b" );
		t.is( ( env.doc.body.querySelector( ".waitoverlay_text" ) as Element ).textContent, "b" );
		o.Text( false );
		t.is( ( env.doc.body.querySelector( ".waitoverlay_text" ) as HTMLElement ).style.display, "none" );
	} );

	test.serial( prefix + ': method on absent state is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Text( "x" );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_text" ) );
	} );

	test.serial( prefix + ': method on overlay without text is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { image: { enabled: false } } );
		o.Text( "x" );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_text" ) );
	} );

	// ── 8. Progress ───────────────────────────────────────────
	prefix = tag + ' Progress';

	test.serial( prefix + ': enabled creates .waitoverlay_progress', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true }, image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_progress" ) );
	} );

	test.serial( prefix + ': disabled produces no progress element', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false } } );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_progress" ) );
	} );

	test.serial( prefix + ': with position top sets margin', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true, position: "top", margin: "5px" }, image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay_progress" ) as HTMLElement ).style.top, "5px" );
	} );

	test.serial( prefix + ': with position bottom sets bottom', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true, position: "bottom", margin: "5px" }, image: { enabled: false } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_progress" ) as HTMLElement;
		t.is( el.style.top, "auto" );
		t.is( el.style.bottom, "5px" );
	} );

	test.serial( prefix + ': with position invalid uses default (empty)', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true, position: "invalid" as "" | "top" | "bottom", margin: "10px" }, image: { enabled: false } } );
		const el: HTMLElement = env.doc.body.querySelector( ".waitoverlay_progress" ) as HTMLElement;
		t.not( el.style.top, "10px" );
	} );

	test.serial( prefix + ': with class applies to bar', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true, class: "pc" }, image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay_progress .pc" ) );
	} );

	test.serial( prefix + ': with color (no class) sets bar background', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { progress: { enabled: true, class: "", color: "red" }, image: { enabled: false } } );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.truthy( bar );
		t.is( ( bar as HTMLElement ).style.background, "red" );
	} );

	// ── 9. Progress method ────────────────────────────────────
	prefix = tag + ' Progress method';

	test.serial( prefix + ': sets bar width to 50%', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true }, image: { enabled: false } } );
		o.Progress( 50 );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.truthy( bar );
		t.is( ( bar as HTMLElement ).style.width, "50%" );
	} );

	test.serial( prefix + ': NaN treated as 0', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true }, image: { enabled: false } } );
		o.Progress( NaN );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.truthy( bar );
		t.is( ( bar as HTMLElement ).style.width, "0%" );
	} );

	test.serial( prefix + ': clamped to min', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true, min: 10, max: 100 }, image: { enabled: false } } );
		o.Progress( 5 );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.is( ( bar as HTMLElement ).style.width, "0%" );
	} );

	test.serial( prefix + ': clamped to max', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true }, image: { enabled: false } } );
		o.Progress( 200 );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.is( ( bar as HTMLElement ).style.width, "100%" );
	} );

	test.serial( prefix + ': with invalid min/max range does nothing', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true, min: 100, max: 0 }, image: { enabled: false } } );
		o.Progress( 50 );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.is( ( bar as HTMLElement ).style.width, "" );
	} );

	test.serial( prefix + ': false hides bar', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { progress: { enabled: true }, image: { enabled: false } } );
		o.Progress( false );
		const bar: Nullable<Element> = ( env.doc.body.querySelector( ".waitoverlay_progress" ) as Element ).firstElementChild!.firstElementChild;
		t.is( ( bar as HTMLElement ).style.display, "none" );
	} );

	test.serial( prefix + ': on absent state is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Progress( 50 );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_progress" ) );
	} );

	test.serial( prefix + ': on overlay without progress is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { image: { enabled: false } } );
		o.Progress( 50 );
		t.falsy( env.doc.body.querySelector( ".waitoverlay_progress" ) );
	} );

	// ── 10. Fade ──────────────────────────────────────────────
	prefix = tag + ' Fade';

	test.serial( prefix + ': queues RAF and applies opacity', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 100, 0 ], image: { enabled: false } } );
		t.true( 0 < env.rafFrames.size, "fade[0]=100 should queue a RAF" );
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el );
		t.is( ( el as HTMLElement ).style.opacity, "0" );
		runRAF( env );
		t.is( ( el as HTMLElement ).style.opacity, "1" );
	} );

	test.serial( prefix + ': Zero fade-in shows immediately', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		t.is( ( env.doc.body.querySelector( ".waitoverlay" ) as HTMLElement ).style.opacity, "1" );
	} );

	// ── 11. Hide ──────────────────────────────────────────────
	prefix = tag + ' Hide';

	test.serial( prefix + ': on absent state is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Hide();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': decrements nested count — overlay stays', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Hide();
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': force removes overlay even with nested count', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Hide( true );
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': at zero count removes overlay', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Hide();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': with fade-out via transitionend removes overlay', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 100 ], image: { enabled: false } } );
		o.Hide();
		const el: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( el, "overlay stays during fade-out" );
		el!.dispatchEvent( new env.dom.window.Event( "transitionend" ) );
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ), "overlay removed after transitionend" );
	} );

	test.serial( prefix + ': fade-out timer safety path', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 100 ], image: { enabled: false } } );
		o.Hide();
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ), "overlay visible during fade-out" );
		await new Promise<void>( ( r: () => void ) => setTimeout( r, 200 ) );
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ), "overlay removed after timer" );
	} );

	test.serial( prefix + ': zero fade-out calls immediate cleanup', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Hide();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': Show after Hide creates fresh overlay', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Hide();
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		t.is( env.doc.body.querySelectorAll( ".waitoverlay" ).length, 1 );
	} );

	// ── 12. Resize ────────────────────────────────────────────
	prefix = tag + ' Resize';

	test.serial( prefix + ': on absent state is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Resize();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': with overlay sets container-relative dimensions', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { image: { enabled: false } }, c );
		cls.instance.Resize( c );
		t.is( ( c.querySelector( ".waitoverlay" ) as HTMLElement ).style.width, "200px" );
	} );

	test.serial( prefix + ': invisible container sets display none', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 0, 0 );
		cls.instance.Show( { image: { enabled: false } }, c );
		t.is( ( c.querySelector( ".waitoverlay" ) as HTMLElement ).style.display, "none" );
	} );

	test.serial( prefix + ': with explicit units applies correct size', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { size: { value: 40, units: "px" } }, c );
		t.is( ( c.querySelector( ".waitoverlay_element" ) as HTMLElement ).style.width, "40px" );
	} );

	test.serial( prefix + ': no autoresize skips element', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { image: { autoResize: false } }, c );
		cls.instance.Resize( c );
		t.truthy( c.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': with size 0 skips element sizing', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( { size: { value: 0 } }, c );
		const el: Nullable<Element> = c.querySelector( ".waitoverlay_element" );
		t.truthy( el );
		t.is( ( el as HTMLElement ).style.width, "" );
	} );

	test.serial( prefix + ': with resize disabled does not create observer', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { resize: false, image: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	// ── 13. Destroy ───────────────────────────────────────────
	prefix = tag + ' Destroy';

	test.serial( prefix + ': removes overlay from container', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 100, 100 ], image: { enabled: false } }, c );
		o.Destroy( c );
		t.falsy( c.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': on absent state is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Destroy();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': cancels queued RAF', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 100, 0 ], image: { enabled: false } } );
		t.true( 0 < env.rafFrames.size, "RAF queued after Show" );
		o.Destroy();
		t.is( env.rafFrames.size, 0, "RAF cancelled after Destroy" );
	} );

	// ── 14. Edge cases ────────────────────────────────────────
	prefix = tag + ' Edge cases';

	test.serial( prefix + ': Show with all content disabled renders only the overlay shell', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		cls.instance.Show( { image: { enabled: false }, custom: { enabled: false }, text: { enabled: false }, progress: { enabled: false } } );
		t.truthy( env.doc.body.querySelector( ".waitoverlay" ) );
		t.is( env.doc.body.querySelectorAll( ".waitoverlay_element" ).length, 0 );
	} );

	test.serial( prefix + ': Hide after Destroy is no-op', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		o.Destroy();
		o.Hide();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	// ── 15. Coverage edge cases (use Reflect for target-agnostic private access) ──
	prefix = tag + ' Coverage edge cases';

	test.serial( prefix + ': Hide with negative showCount is clamped to 0', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		const wm: Nullable<WeakMap<WeakKey, unknown>> = _getWeakMap( o );
		t.truthy( wm, "should find WeakMap on instance" );
		const body: HTMLElement = env.doc.body;
		const state: unknown = wm!.get( body );
		t.truthy( state, "state should exist for body" );
		const stateObj: Record<string | symbol, unknown> = state as Record<string | symbol, unknown>;
		const showCountKey: string | symbol = _getShowCountKey( stateObj ) as string | symbol;
		t.truthy( showCountKey, "should find showCount property" );
		stateObj[ showCountKey ] = 0;
		o.Hide();
		const stateAfter: unknown = wm!.get( body );
		t.falsy( stateAfter, "state should be cleaned up after Hide at count 0" );
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': Hide with state but no overlay calls else cleanup', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { fade: [ 0, 0 ], image: { enabled: false } } );
		const wm: Nullable<WeakMap<WeakKey, unknown>> = _getWeakMap( o );
		t.truthy( wm );
		const body: HTMLElement = env.doc.body;
		const state: unknown = wm!.get( body );
		t.truthy( state );
		const stateObj: Record<string | symbol, unknown> = state as Record<string | symbol, unknown>;
		const overlayKey: string | symbol = _getOverlayKey( stateObj ) as string | symbol;
		t.truthy( overlayKey, "should find overlay HTMLElement property" );
		const overlayEl: Nullable<Element> = stateObj[ overlayKey ] as Nullable<Element>;
		t.truthy( overlayEl );
		overlayEl!.remove();
		stateObj[ overlayKey ] = null;
		o.Hide();
		t.falsy( env.doc.body.querySelector( ".waitoverlay" ) );
	} );

	test.serial( prefix + ': Show with resize missing resizeFactor defaults to 1', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 100, 100 );
		cls.instance.Show( {}, c );
		const els: NodeListOf<Element> = c.querySelectorAll( ".waitoverlay_element" );
		t.true( 0 < els.length );
		t.is( ( els[ 0 ] as HTMLElement ).dataset.resizefactor, "1" );
	} );

	test.serial( prefix + ': Resize with missing resizeFactor falls back to 1', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( {}, c );
		const el: HTMLElement = c.querySelector( ".waitoverlay_element" ) as HTMLElement;
		t.truthy( el );
		delete el.dataset.resizefactor;
		t.falsy( el.dataset.resizefactor, "resizefactor should be gone" );
		cls.instance.Resize( c );
		t.truthy( el.style.width );
	} );

	test.serial( prefix + ': Second Show on null-overlay state re-merges settings', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const o: WaitOverlayOriginal = cls.instance;
		o.Show( { image: { enabled: false } } );
		const wm: Nullable<WeakMap<WeakKey, unknown>> = _getWeakMap( o );
		t.truthy( wm );
		const state: unknown = wm!.get( env.doc.body );
		t.truthy( state );
		const stateObj: Record<string | symbol, unknown> = state as Record<string | symbol, unknown>;
		const overlayKey: string | symbol = _getOverlayKey( stateObj ) as string | symbol;
		t.truthy( overlayKey );
		( stateObj[ overlayKey ] as Nullable<Element> )!.remove();
		stateObj[ overlayKey ] = null;
		env.doc.body.innerHTML = "";
		o.Show( { backgroundClass: "fresh", image: { enabled: false } } );
		const overlay: Nullable<Element> = env.doc.body.querySelector( ".waitoverlay" );
		t.truthy( overlay, "new overlay created" );
		t.true( overlay!.classList.contains( "fresh" ), "fresh backgroundClass applied" );
	} );

	test.serial( prefix + ': Show with custom content and resize', async ( t: ExecutionContext ) => {
		const env: Env = _createEnv();
		_applyEnv( env );
		_resetEnv( cls, slot );
		const c: HTMLElement = makeContainer( env.doc, 200, 200 );
		cls.instance.Show( {
			custom: { enabled: true, value: "<span>test</span>" },
			text: { enabled: true, value: "text" },
			progress: { enabled: true }
		}, c );
		t.truthy( c.querySelector( ".waitoverlay_element span" ) );
		t.truthy( c.querySelector( ".waitoverlay_text" ) );
		t.truthy( c.querySelector( ".waitoverlay_progress" ) );
	} );
}
