'use strict';

/*
 * WaitOverlay - A vanilla typescript rewrite of jquery-loading-overlay (https://gasparesganga.com/labs/jquery-loading-overlay/)
 */

type Undefinedable<T> = T | undefined;
type Nullable<T> = T | null;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

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
	direction: "row" | "column";
	fade: [ number, number ];
	zIndex: Undefinedable<number>;
};

interface ProgressData {
	_bar: HTMLElement;
	_position: string;
	_margin: string;
	_min: number;
	_max: number;
	_speed: number;
}

interface OverlayState {
	_wholePage: boolean;
	_settings: Settings;
	_overlay: Nullable<HTMLElement>;
	_text: Nullable<HTMLElement>;
	_progress: Nullable<ProgressData>;
	_resizeObserver: Undefinedable<ResizeObserver>;
	_fadeAnimationId: Undefinedable<number>;
	_fadeTimeoutId: Undefinedable<number>;
	_showCount: number;
}

interface CssProperties {
	[ key: string ]: string;
}

// ── Singleton Class ───────────────────────────────────────────

export default class WaitOverlay {
	private static _deepMerge<T extends Record<string, any>>( target: T, ...sources: DeepPartial<T>[] ): T {
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
		WaitOverlay._applyCss( element, WaitOverlay._css._element );
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

	private static readonly _validSizes: RegExp = /^(0*(?:\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?))(vm[ai]x|r?em|in|p[tcx]|v[hw]|[cm]m)$/;
	private static readonly _validCSSTime: RegExp = /^(?:\d+)(?:\.\d+)?(?:ms|s)$/;
	private static readonly _validCSSAnimations: string[] = [ "rotate_right", "rotate_left", "fadein", "pulse" ];
	private static readonly _validProgressPositions: string[] = [ "top", "bottom" ];

	private static readonly _css: Record<string, CssProperties> = {
		_overlay: {
			"box-sizing": "border-box",
			"position": "relative",
			"display": "flex",
			"flex-wrap": "nowrap",
			"align-items": "center",
			"justify-content": "space-around"
		},
		_element: {
			"box-sizing": "border-box",
			"overflow": "visible",
			"flex": "0 0 auto",
			"display": "flex",
			"justify-content": "center",
			"align-items": "center"
		},
		_svg: {
			"width": "100%",
			"height": "100%"
		},
		_progressBar: {
			"position": "absolute",
			"left": "0"
		},
		_progressFixed: {
			"position": "absolute",
			"left": "0",
			"width": "100%"
		},
		_progressBarWrapper: {
			"position": "absolute",
			"top": "0",
			"left": "0",
			"width": "100%",
			"height": "100%"
		},
		_fixedPositioning: {
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

	public Show( options?: DeepPartial<Settings>, container?: HTMLElement ): void {
		const target: HTMLElement = container || document.body;
		const state: OverlayState = this._getState( target, options );
		state._showCount++;
		if( !state._overlay ) {
			const overlay: HTMLElement = document.createElement( "div" );
			overlay.className = "waitoverlay";
			WaitOverlay._applyCss( overlay, WaitOverlay._css._overlay );
			overlay.style.flexDirection = ( "row" === state._settings.direction.toLowerCase() ? "row" : "column" );
			if( state._settings.backgroundClass ) {
				overlay.classList.add( state._settings.backgroundClass );
			} else {
				overlay.style.background = state._settings.background;
			}
			if( state._wholePage ) {
				WaitOverlay._applyCss( overlay, WaitOverlay._css._fixedPositioning );
			}
			if( undefined !== state._settings.zIndex ) {
				overlay.style.zIndex = String( state._settings.zIndex );
			}
			if( state._settings.image.enabled ) {
				const elementSettings = state._settings.image;
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
					this._applyInlineSvgStyles( element, state._settings );
				} else if( ".svg" == image.slice( -4 ) || "data:image/svg" == image.slice( 0, 14 ) ) {
					fetch( elementSettings.value, { method: "GET" } )
						.then( ( response ) => response.text() )
						.then( ( svgContent ) => {
							if( state._overlay ) {
								element.innerHTML = svgContent;
								this._applyInlineSvgStyles( element, state._settings );
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
			if( state._settings.custom.enabled ) {
				const elementSettings = state._settings.custom;
				const element: HTMLElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor,
					elementSettings.animation
				);
				element.innerHTML = elementSettings.value;
			}
			if( state._settings.text.enabled ) {
				const elementSettings = state._settings.text;
				state._text = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor,
					elementSettings.animation
				);
				state._text.classList.add( "waitoverlay_text" );
				state._text.textContent = elementSettings.value;
				if( elementSettings.class ) {
					state._text.classList.add( elementSettings.class );
				} else if( elementSettings.color ) {
					state._text.style.color = elementSettings.color;
				}
			}
			if( state._settings.progress.enabled ) {
				const elementSettings = state._settings.progress;
				const element: HTMLElement = WaitOverlay._createElement(
					overlay,
					elementSettings.order,
					elementSettings.autoResize,
					elementSettings.resizeFactor
				);
				element.classList.add( "waitoverlay_progress" );
				const wrapper: HTMLElement = document.createElement( "div" );
				WaitOverlay._applyCss( wrapper, WaitOverlay._css._progressBarWrapper );
				element.appendChild( wrapper );
				const bar: HTMLElement = document.createElement( "div" );
				WaitOverlay._applyCss( bar, WaitOverlay._css._progressBar );
				wrapper.appendChild( bar );
				const progressData: ProgressData = {
					_bar: bar,
					_position: "",
					_margin: "0",
					_min: parseFloat( String( elementSettings.min ) ),
					_max: parseFloat( String( elementSettings.max ) ),
					_speed: parseInt( String( elementSettings.speed ), 10 )
				};
				if( WaitOverlay._validProgressPositions.includes( elementSettings.position ) ) {
					progressData._position = elementSettings.position;
				}
				if( WaitOverlay._validSizes.test( elementSettings.margin ) ) {
					progressData._margin = elementSettings.margin;
				}
				WaitOverlay._applyCss( element, WaitOverlay._css._progressFixed );
				switch( progressData._position ) {
					case "top": {
						element.style.top = progressData._margin;
						break;
					}
					case "bottom": {
						element.style.top = "auto";
						element.style.bottom = progressData._margin;
						break;
					}
				}
				if( elementSettings.class ) {
					bar.classList.add( elementSettings.class );
				} else if( elementSettings.color ) {
					bar.style.background = elementSettings.color;
				}
				state._progress = progressData;
			}
			state._overlay = overlay;
			target.appendChild( overlay );
			if( state._settings.resize ) {
				this._intervalResize( state, target, true );
				const observer = new ResizeObserver( () => {
					this._intervalResize( state, target, false );
				} );
				observer.observe( target );
				state._resizeObserver = observer;
			}
			overlay.style.opacity = "1";
			if( 0 < state._settings.fade[ 0 ] ) {
				overlay.style.opacity = "0";
				overlay.style.transition = "opacity " + state._settings.fade[ 0 ] + "ms";
				state._fadeAnimationId = requestAnimationFrame(
					(): void => {
						if( state._overlay ) {
							state._overlay.style.opacity = "1";
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
			state._showCount--;
			if( state._showCount < 0 ) {
				state._showCount = 0;
			}
			if( force || 0 >= state._showCount ) {
				if( state._overlay ) {
					const overlay = state._overlay;
					const fadeDuration = state._settings.fade[ 1 ];
					if( 0 < fadeDuration ) {
						overlay.style.transition = "opacity " + fadeDuration + "ms";
						overlay.addEventListener( "transitionend", () => {
							this._cleanup( state, target );
						}, { once: true } );
						state._fadeTimeoutId = setTimeout( () => {
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

	public Resize( container?: HTMLElement ): void {
		const target: HTMLElement = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state._overlay ) {
			this._intervalResize( state, target, true );
		}
	}

	public Text( value: string | false, container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state._text ) {
			state._text.style.display = "none";
			if( false !== value ) {
				state._text.style.display = "";
				state._text.textContent = value;
			}
		}
	}

	public Progress( value: number | false, container?: Element ): void {
		const target: Element = container || document.body;
		const state: Undefinedable<OverlayState> = this._states.get( target );
		if( state && state._progress ) {
			if( false === value ) {
				state._progress._bar.style.display = "none";
			} else if( state._progress._max > state._progress._min ) {
				let v: number = ( ( isNaN( value ) ? 0 : value ) - state._progress._min ) * 100 / ( state._progress._max - state._progress._min );
				v = Math.max( 0, Math.min( 100, v ) || 0 );
				state._progress._bar.style.display = "";
				state._progress._bar.style.transition = "width " + state._progress._speed + "ms";
				state._progress._bar.style.width = v + "%";
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

	public Configure( settings: DeepPartial<Settings> ): void {
		this._settings = WaitOverlay._deepMerge( this._settings, settings );
	}

	private _getState( container: Element, options?: DeepPartial<Settings> ): OverlayState {
		let state: Undefinedable<OverlayState> = this._states.get( container );
		const settings: Settings = ( !state || ( null === state._overlay ) ) ? WaitOverlay._deepMerge( this._settings, options || {} ) : state._settings;
		if( !state ) {
			state = {
				_wholePage: container === document.body,
				_settings: {} as Settings,
				_overlay: null,
				_text: null,
				_progress: null,
				_resizeObserver: undefined,
				_fadeAnimationId: undefined,
				_fadeTimeoutId: undefined,
				_showCount: 0
			};
			this._states.set( container, state );
		}
		state._settings = settings;
		return state;
	}

	private _intervalResize( state: OverlayState, container: HTMLElement, force: boolean ): void {
		if( state._overlay ) {
			const overlay: HTMLElement = state._overlay;
			const visible: boolean = 0 < container.offsetWidth || 0 < container.offsetHeight;
			overlay.style.display = visible ? WaitOverlay._css._overlay.display : "none";
			if( !state._wholePage ) {
				overlay.style.position = "absolute";
				overlay.style.top = "0";
				overlay.style.left = "0";
				overlay.style.width = container.offsetWidth + "px";
				overlay.style.height = container.offsetHeight + "px";
			}
			if( 0 < state._settings.size.value ) {
				let size: number = state._settings.size.value;
				if( "" === state._settings.size.units ) {
					let containerWidth: number;
					let containerHeight: number;
					if( state._wholePage ) {
						containerWidth = window.innerWidth;
						containerHeight = window.innerHeight;
					} else {
						containerWidth = container.clientWidth;
						containerHeight = container.clientHeight;
					}
					size = Math.min( containerWidth, containerHeight ) * size / 100;
					if( state._settings.maxSize && size > state._settings.maxSize ) {
						size = state._settings.maxSize;
					}
					if( state._settings.minSize && size < state._settings.minSize ) {
						size = state._settings.minSize;
					}
				}
				const units: Units = state._settings.size.units || "px";
				overlay.querySelectorAll<HTMLElement>( ":scope > .waitoverlay_element" ).forEach(
					( element: HTMLElement ): void => {
						if( force || "1" === element.dataset.autoresize ) {
							const resizeFactor: number = parseFloat( element.dataset.resizefactor || "1" );
							const sizeValue: string = ( size * resizeFactor ) + units;
							if( element.classList.contains( "waitoverlay_fa" ) || element.classList.contains( "waitoverlay_text" ) ) {
								element.style.fontSize = sizeValue;
							} else if( element.classList.contains( "waitoverlay_progress" ) ) {
								if( state._progress ) {
									state._progress._bar.style.height = sizeValue;
									switch( state._progress._position ) {
										case "top": {
											element.style.top = state._progress._margin;
											const currentTop = element.offsetTop;
											state._progress._bar.style.top = ( currentTop - ( size * resizeFactor * 0.5 ) ) + units;
											break;
										}
										case "bottom": {
											element.style.top = "auto";
											element.style.bottom = state._progress._margin;
											break;
										}
									}
								}
							} else {
								element.style.width = sizeValue;
								element.style.height = sizeValue;
							}
						}
					}
				);
			}
		}
	}

	private _cleanup( state: OverlayState, container: Element ): void {
		if( state._resizeObserver ) {
			state._resizeObserver.disconnect();
			state._resizeObserver = undefined;
		}
		if( undefined !== state._fadeAnimationId ) {
			cancelAnimationFrame( state._fadeAnimationId );
			state._fadeAnimationId = undefined;
		}
		if( undefined !== state._fadeTimeoutId ) {
			clearTimeout( state._fadeTimeoutId );
			state._fadeTimeoutId = undefined;
		}
		if( state._overlay ) {
			state._overlay.remove();
			state._overlay = null;
		}
		state._text = null;
		state._progress = null;
		state._showCount = 0;
		this._states.delete( container );
	}

	private _applyInlineSvgStyles( element: HTMLElement, settings: Settings ): void {
		const svgChild: Nullable<Element> = element.firstElementChild;
		if( svgChild instanceof SVGElement ) {
			WaitOverlay._applyCss( svgChild, WaitOverlay._css._svg );
		}
		if( !settings.image.class && settings.image.color.fill ) {
			const children: NodeListOf<HTMLElement> = element.querySelectorAll<HTMLElement>( "*" );
			children.forEach( ( child: HTMLElement ): void => {
				child.style.fill = settings.image.color.fill;
				if( settings.image.color.stroke ) {
					child.style.stroke = settings.image.color.stroke;
				}
			} );
		}
	}
}