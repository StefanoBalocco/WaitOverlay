declare module 'jsdom' {
	export class JSDOM {
		constructor( html: string, options?: { url?: string; pretendToBeVisual?: boolean } );
		readonly window: Window & typeof globalThis;
	}
}

declare module '*.min.js' {
	const value: unknown;
	export default value;
}
