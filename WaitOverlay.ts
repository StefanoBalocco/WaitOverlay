'use strict';

/*
 * WaitOverlay - A vanilla typescript rewrite of jquery-loading-overlay (https://gasparesganga.com/labs/jquery-loading-overlay/)
 */

type Undefinedable<T> = T | undefined;
type Nullable<T> = T | null;

type Animation = {
	name: string;
	time: string;
}

type Units = "vmin" | "vmax" |
	"em" | "rem" |
	"pt" | "pc" |
	"in" | "cm" | "mm" |
	"vh" | "vw" |
	"px" | ""

export type Settings = {
	resize: boolean,
	background: string,
	backgroundClass: string,
	image: {
		enabled: boolean,
		value: string,
		class: string,
		autoResize: boolean,
		resizeFactor: number,
		color: {
			fill: string;
			stroke?: string;
		},
		order: number,
		animation: Animation
	},
	custom: {
		enabled: boolean,
		value: string,
		autoResize: boolean,
		resizeFactor: number,
		order: number,
		animation: Animation
	},
	text: {
		enabled: boolean,
		value: string,
		class: string,
		autoResize: boolean,
		resizeFactor: number,
		color: string,
		order: number,
		animation: Animation
	}
	progress: {
		enabled: boolean,
		class: string,
		autoResize: boolean,
		resizeFactor: number,
		min: number,
		max: number,
		speed: number,
		position: "" | "top" | "bottom",
		margin: string,
		color: string,
		order: number
	},
	size: {
		value: number,
		units: Units
	},
	maxSize: number;
	minSize: number;
	direction: string;
	fade: [ number, number ];
	zIndex: Undefinedable<number>;
};

interface ProgressData {
	bar: HTMLElement;
	position: string;
	margin: string;
	min: number;
	max: number;
	speed: number;
}

interface OverlayState {
	wholePage: boolean;
	settings: Settings;
	overlayElement: Nullable<HTMLElement>;
	textElement: Nullable<HTMLElement>;
	progress: Nullable<ProgressData>;
	resizeObserver: Undefinedable<ResizeObserver>;
	fadeAnimationId: Undefinedable<number>;
	showCount: number;
}

interface CssProperties {
	[ key: string ]: string;
}

// ── Singleton Class ───────────────────────────────────────────

export default class WaitOverlay {
	private static _deepMerge<T extends Record<string, any>>( target: T, ...sources: Partial<T>[] ): T {
		const result: Record<string, any> = structuredClone( target );
		for( const source of sources ) {
			if( source ) {
				for( const key of Object.keys( source ) ) {
					const sourceVal = ( source as Record<string, any> )[ key ];
					const targetVal = result[ key ];
					if(
						null !== sourceVal
						&& "object" === typeof sourceVal
						&& !Array.isArray( sourceVal )
						&& null !== targetVal
						&& "object" === typeof targetVal
						&& !Array.isArray( targetVal )
					) {
						result[ key ] = WaitOverlay._deepMerge( targetVal, sourceVal );
					} else if( null !== sourceVal && "object" === typeof sourceVal ) {
						result[ key ] = structuredClone( sourceVal );
					} else {
						result[ key ] = sourceVal;
					}
				}
			}
		}
		return result as T;
	}

	private static _applyCss( element: ( HTMLElement | SVGElement ), css: CssProperties ): void {
		for( const prop of Object.keys( css ) ) {
			element.style.setProperty( prop, css[ prop ] );
		}
	}

	private static _createElement(
		overlay: HTMLElement,
		order: number,
		autoResize: boolean,
		resizeFactor: number,
		animation?: Animation
	): HTMLElement {
		const element: HTMLElement = document.createElement( "div" );
		element.className = "waitoverlay_element";
		element.style.order = String( order );
		WaitOverlay._applyCss( element, WaitOverlay._css.element );
		element.dataset.autoresize = autoResize ? "1" : "0";
		element.dataset.resizefactor = String( resizeFactor );
		overlay.appendChild( element );
		if( animation?.name && !WaitOverlay._validCSSAnimations.includes( animation.name ) ) {
			animation.name = "";
		}
		if( animation?.name && animation?.time && WaitOverlay._validCSSTime.test( animation.time ) ) {
			element.style.animationName = "waitoverlay_animation__" + animation.name;
			element.style.animationDuration = animation.time;
			element.style.animationTimingFunction = "linear";
			element.style.animationIterationCount = "infinite";
		}
		return element;
	}

	private static readonly _defaults: Settings = {
		resize: true,
		background: "rgba(255, 255, 255, 0.8)",
		backgroundClass: "",
		image: {
			enabled: true,
			class: "",
			value: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'><circle r='80' cx='500' cy='90'/><circle r='80' cx='500' cy='910'/><circle r='80' cx='90' cy='500'/><circle r='80' cx='910' cy='500'/><circle r='80' cx='212' cy='212'/><circle r='80' cx='788' cy='212'/><circle r='80' cx='212' cy='788'/><circle r='80' cx='788' cy='788'/></svg>",
			autoResize: true,
			resizeFactor: 1,
			color: {
				fill: "#202020"
			},
			order: 1,
			animation: {
				name: "rotate_right",
				time: "2000ms"
			}
		},
		custom: {
			enabled: false,
			value: "",
			autoResize: true,
			resizeFactor: 1,
			order: 3,
			animation: {
				name: "",
				time: ""
			}
		},
		text: {
			enabled: false,
			value: "",
			class: "",
			autoResize: true,
			resizeFactor: 0.5,
			color: "#202020",
			order: 4,
			animation: {
				name: "",
				time: ""
			}
		},
		progress: {
			enabled: false,
			class: "",
			autoResize: true,
			resizeFactor: 0.25,
			min: 0,
			max: 100,
			speed: 200,
			position: "",
			margin: "",
			color: "#a0a0a0",
			order: 5
		},
		size: {
			value: 50,
			units: ''
		},
		maxSize: 120,
		minSize: 20,
		direction: "column",
		fade: [ 400, 200 ],
		zIndex: 2147483647
	};

	private static readonly _validSizes: RegExp = /^(0*(?:\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?))(vm[ai]x|r?em|in|p[tcx]|v[hw]|[cm]m|%)$/;
	private static readonly _validCSSTime: RegExp = /^(?:\d+)(?:\.\d+)?(?:ms|s)$/;
	private static readonly _validCSSAnimations: string[] = [ "rotate_right", "rotate_left", "fadein", "pulse" ];
	private static readonly _validProgressPositions: string[] = [ "top", "bottom" ];

	private static readonly _css: Record<string, CssProperties> = {
		overlay: {
			"box-sizing": "border-box",
			"position": "relative",
			"display": "flex",
			"flex-wrap": "nowrap",
			"align-items": "center",
			"justify-content": "space-around"
		},
		element: {
			"box-sizing": "border-box",
			"overflow": "visible",
			"flex": "0 0 auto",
			"display": "flex",
			"justify-content": "center",
			"align-items": "center"
		},
		svg: {
			"width": "100%",
			"height": "100%"
		},
		progressBar: {
			"position": "absolute",
			"left": "0"
		},
		progressFixed: {
			"position": "absolute",
			"left": "0",
			"width": "100%"
		},
		progressBarWrapper: {
			"position": "absolute",
			"top": "0",
			"left": "0",
			"width": "100%",
			"height": "100%"
		},
		fixedPositioning: {
			"position": "fixed",
			"top": "0",
			"left": "0",
			"width": "100%",
			"height": "100%"
		}
	};

	private static _instance: Nullable<WaitOverlay> = null;

	// Static methods
	public static GetInstance(): WaitOverlay {
		if( null === WaitOverlay._instance ) {
			WaitOverlay._instance = new WaitOverlay();
		}
		return WaitOverlay._instance;
	}

	// Instance properties
	private readonly _states: WeakMap<Element, OverlayState>;
	private _settings: Settings;

	// Constructor
	private constructor() {
		this._states = new WeakMap<Element, OverlayState>();
		this._settings = structuredClone( WaitOverlay._defaults );
		const css = [
			"@keyframes waitoverlay_animation__rotate_right {",
			"  to { transform: rotate(360deg); }",
			"}",
			"@keyframes waitoverlay_animation__rotate_left {",
			"  to { transform: rotate(-360deg); }",
			"}",
			"@keyframes waitoverlay_animation__fadein {",
			"  0% { opacity: 0; transform: scale(0.1, 0.1); }",
			"  50% { opacity: 1; }",
			"  100% { opacity: 0; transform: scale(1, 1); }",
			"}",
			"@keyframes waitoverlay_animation__pulse {",
			"  0% { transform: scale(0, 0); }",
			"  50% { transform: scale(1, 1); }",
			"  100% { transform: scale(0, 0); }",
			"}"
		].join( " " );
		const style: HTMLStyleElement = document.createElement( "style" );
		style.textContent = css;
		document.head.appendChild( style );
	}

	public Show( options?: Partial<Settings>, container?: Element ): void {
		const target: Element = container || document.body;
		const state: OverlayState = this._getState( target, options );
		state.showCount++;
		if( !state.overlayElement ) {
			const overlay: HTMLElement = document.createElement( "div" );
			overlay.className = "waitoverlay";
			WaitOverlay._applyCss( overlay, WaitOverlay._css.overlay );
			overlay.style.flexDirection = ( "row" === state.settings.direction.toLowerCase() ? "row" : "column" );
			if( state.settings.backgroundClass ) {
				overlay.classList.add( state.settings.backgroundClass );
			} else {
				overlay.style.background = state.settings.background;
			}
			if( state.wholePage ) {
				WaitOverlay._applyCss( overlay, WaitOverlay._css.fixedPositioning );
			}
			if( undefined !== state.settings.zIndex ) {
				overlay.style.zIndex = String( state.settings.zIndex );
			}
			if( state.settings.image.enabled ) {
				const elementSettings = state.settings.image;
				const element: HTMLElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor,
					elementSettings.animation
				);
				const image: string = elementSettings.value.toLowerCase();
				if( image.startsWith( "<svg" ) && image.endsWith( "</svg>" ) ) {
					element.innerHTML = elementSettings.value;
					this._applyInlineSvgStyles( element, state.settings );
				} else if( ".svg" == image.slice( -4 ) || "data:image/svg" == image.slice( 0, 14 ) ) {
					fetch( elementSettings.value, { method: "GET" } )
						.then( ( response ) => response.text() )
						.then( ( svgContent ) => {
							if( state.overlayElement ) {
								element.innerHTML = svgContent;
								this._applyInlineSvgStyles( element, state.settings );
							}
						} )
						.catch( () => {} );
				} else {
					element.style.backgroundImage = "url(" + elementSettings.value + ")";
					element.style.backgroundPosition = "center";
					element.style.backgroundRepeat = "no-repeat";
					element.style.backgroundSize = "cover";
				}
				if( elementSettings.class ) {
					element.classList.add( elementSettings.class );
				}
			}
			if( state.settings.custom.enabled ) {
				const elementSettings = state.settings.custom;
				const element: HTMLElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor,
					elementSettings.animation
				);
				element.innerHTML = elementSettings.value;
			}
			if( state.settings.text.enabled ) {
				const elementSettings = state.settings.text;
				state.textElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor,
					elementSettings.animation
				);
				state.textElement.classList.add( "waitoverlay_text" );
				state.textElement.textContent = elementSettings.value;
				if( elementSettings.class ) {
					state.textElement.classList.add( elementSettings.class );
				} else if( elementSettings.color ) {
					state.textElement.style.color = elementSettings.color;
				}
			}
			if( state.settings.progress.enabled ) {
				const elementSettings = state.settings.progress;
				const element: HTMLElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor
				);
				element.classList.add( "waitoverlay_progress" );
				const wrapper: HTMLElement = document.createElement( "div" );
				WaitOverlay._applyCss( wrapper, WaitOverlay._css.progressBarWrapper );
				element.appendChild( wrapper );
				const bar: HTMLElement = document.createElement( "div" );
				WaitOverlay._applyCss( bar, WaitOverlay._css.progressBar );
				wrapper.appendChild( bar );
				const progressData: ProgressData = {
					bar: bar,
					position: "",
					margin: "0",
					min: parseFloat( String( elementSettings.min ) ),
					max: parseFloat( String( elementSettings.max ) ),
					speed: parseInt( String( elementSettings.speed ), 10 )
				};
				if( WaitOverlay._validProgressPositions.includes( elementSettings.position ) ) {
					progressData.position = elementSettings.position;
				}
				if( WaitOverlay._validSizes.test( elementSettings.margin ) ) {
					progressData.margin = elementSettings.margin;
				}
				WaitOverlay._applyCss( element, WaitOverlay._css.progressFixed );
				switch( progressData.position ) {
					case "top": {
						element.style.top = progressData.margin;
						break;
					}
					case "bottom": {
						element.style.top = "auto";
						element.style.bottom = progressData.margin;
						break;
					}
				}
				if( elementSettings.class ) {
					bar.classList.add( elementSettings.class );
				} else if( elementSettings.color ) {
					bar.style.background = elementSettings.color;
				}
				state.progress = progressData;
			}
			state.overlayElement = overlay;
			target.appendChild( overlay );
			if( state.settings.resize ) {
				this._intervalResize( state, target, true );
				const observer = new ResizeObserver( () => {
					this._intervalResize( state, target, false );
				} );
				observer.observe( target );
				state.resizeObserver = observer;
			}
			overlay.style.opacity = "1";
			if( 0 < state.settings.fade[ 0 ] ) {
				overlay.style.opacity = "0";
				overlay.style.transition = "opacity " + state.settings.fade[ 0 ] + "ms";
				state.fadeAnimationId = requestAnimationFrame(
					(): void => {
						if( state.overlayElement ) {
							state.overlayElement.style.opacity = "1";
						}
					}
				);
			}
		}
	}

	public Hide( force?: boolean, container?: Element ): void {
		const target = container || document.body;
		const state = this._states.get( target );
		if( state ) {
			state.showCount--;
			if( state.showCount < 0 ) {
				state.showCount = 0;
			}
			if( force || 0 >= state.showCount ) {
				if( state.overlayElement ) {
					const overlay = state.overlayElement;
					const fadeDuration = state.settings.fade[ 1 ];
					if( 0 < fadeDuration ) {
						overlay.style.transition = "opacity " + fadeDuration + "ms";
						overlay.addEventListener( "transitionend", () => {
							this._cleanup( state, target );
						}, { once: true } );
						setTimeout( () => {
							this._cleanup( state, target );
						}, fadeDuration + 50 );
						overlay.style.opacity = "0";
					} else {
						this._cleanup( state, target );
					}
				} else {
					this._cleanup( state, target );
				}
			}
		}
	}

	public Resize( container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state.overlayElement ) {
			this._intervalResize( state, target, true );
		}
	}

	public Text( value: string | false, container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state.textElement ) {
			state.textElement.style.display = "none";
			if( false !== value ) {
				state.textElement.style.display = "";
				state.textElement.textContent = value;
			}
		}
	}

	public Progress( value: number | false, container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state.progress ) {
			if( false === value ) {
				state.progress.bar.style.display = "none";
			} else if( state.progress.max > state.progress.min ) {
				let v: number = ( ( isNaN( value ) ? 0 : value ) - state.progress.min ) * 100 / ( state.progress.max - state.progress.min );
				v = Math.max( 0, Math.min( 100, v ) || 0 );
				state.progress.bar.style.display = "";
				state.progress.bar.style.transition = "width " + state.progress.speed + "ms";
				state.progress.bar.style.width = v + "%";
			}
		}
	}

	public Destroy( container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state ) {
			this._cleanup( state, target );
		}
	}

	public Configure( settings: Partial<Settings> ): void {
		this._settings = WaitOverlay._deepMerge( this._settings, settings );
	}

	private _getState( container: Element, options?: Partial<Settings> ): OverlayState {
		let state: Undefinedable<OverlayState> = this._states.get( container );
		const settings: Settings = ( !state || ( null === state.overlayElement ) ) ? WaitOverlay._deepMerge( this._settings, options || {} ) : state.settings;
		if( !state ) {
			state = {
				wholePage: container === document.body,
				settings: {} as Settings,
				overlayElement: null,
				textElement: null,
				progress: null,
				resizeObserver: undefined,
				fadeAnimationId: undefined,
				showCount: 0
			};
			this._states.set( container, state );
		}
		state.settings = settings;
		return state;
	}

	private _intervalResize( state: OverlayState, container: Element, force: boolean ): void {
		if( state.overlayElement ) {
			const overlay = state.overlayElement;
			const htmlContainer = container as HTMLElement;
			const visible = 0 < htmlContainer.offsetWidth || 0 < htmlContainer.offsetHeight;
			overlay.style.display = visible ? WaitOverlay._css.overlay.display : "none";
			if( !state.wholePage ) {
				overlay.style.position = "absolute";
				overlay.style.top = "0";
				overlay.style.left = "0";
				overlay.style.width = htmlContainer.offsetWidth + "px";
				overlay.style.height = htmlContainer.offsetHeight + "px";
			}
			if( 0 < state.settings.size.value ) {
				let size: number = state.settings.size.value;
				if( "" === state.settings.size.units ) {
					let containerWidth: number;
					let containerHeight: number;
					if( state.wholePage ) {
						containerWidth = window.innerWidth;
						containerHeight = window.innerHeight;
					} else {
						containerWidth = htmlContainer.clientWidth;
						containerHeight = htmlContainer.clientHeight;
					}
					size = Math.min( containerWidth, containerHeight ) * size / 100;
					if( state.settings.maxSize && size > state.settings.maxSize ) {
						size = state.settings.maxSize;
					}
					if( state.settings.minSize && size < state.settings.minSize ) {
						size = state.settings.minSize;
					}
				}
				const units: Units = state.settings.size.units || "px";
				overlay.querySelectorAll( ":scope > .waitoverlay_element" ).forEach(
					( el: Element ): void => {
						const htmlEl = el as HTMLElement;
						if( force || "1" === htmlEl.dataset.autoresize ) {
							const resizeFactor: number = parseFloat( htmlEl.dataset.resizefactor || "1" );
							const sizeValue: string = ( size * resizeFactor ) + units;
							if( htmlEl.classList.contains( "waitoverlay_fa" ) || htmlEl.classList.contains( "waitoverlay_text" ) ) {
								htmlEl.style.fontSize = sizeValue;
							} else if( htmlEl.classList.contains( "waitoverlay_progress" ) ) {
								if( state.progress ) {
									state.progress.bar.style.height = sizeValue;
									switch( state.progress.position ) {
										case "top": {
											htmlEl.style.top = state.progress.margin;
											const currentTop = htmlEl.offsetTop;
											state.progress.bar.style.top = ( currentTop - ( size * resizeFactor * 0.5 ) ) + units;
											break;
										}
										case "bottom": {
											htmlEl.style.top = "auto";
											htmlEl.style.bottom = state.progress.margin;
											break;
										}
									}
								}
							} else {
								htmlEl.style.width = sizeValue;
								htmlEl.style.height = sizeValue;
							}
						}
					}
				);
			}
		}
	}

	private _cleanup( state: OverlayState, container: Element ): void {
		if( state.resizeObserver ) {
			state.resizeObserver.disconnect();
			state.resizeObserver = undefined;
		}
		if( state.fadeAnimationId ) {
			cancelAnimationFrame( state.fadeAnimationId );
			state.fadeAnimationId = undefined;
		}
		if( state.overlayElement ) {
			state.overlayElement.remove();
			state.overlayElement = null;
		}
		state.textElement = null;
		state.progress = null;
		state.showCount = 0;
		this._states.delete( container );
	}

	private _applyInlineSvgStyles( element: HTMLElement, settings: Settings ): void {
		const svgChild: Nullable<Element> = element.firstElementChild;
		if( svgChild instanceof SVGElement ) {
			WaitOverlay._applyCss( svgChild, WaitOverlay._css.svg );
		}
		if( !settings.image.class && settings.image.color.fill ) {
			const children = element.querySelectorAll( "*" );
			children.forEach( ( child ) => {
				const htmlChild = child as HTMLElement;
				htmlChild.style.fill = settings.image.color.fill;
				if( settings.image.color.stroke ) {
					htmlChild.style.stroke = settings.image.color.stroke;
				}
			} );
		}
	}
}