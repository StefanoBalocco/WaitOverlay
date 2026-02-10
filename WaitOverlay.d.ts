type Undefinedable<T> = T | undefined;
type Animation = {
    name: string;
    time: string;
};
type Units = "vmin" | "vmax" | "em" | "rem" | "pt" | "pc" | "in" | "cm" | "mm" | "vh" | "vw" | "px" | "";
export type Settings = {
    resize: boolean;
    background: string;
    backgroundClass: string;
    image: {
        enabled: boolean;
        value: string;
        class: string;
        autoResize: boolean;
        resizeFactor: number;
        color: {
            fill: string;
            stroke?: string;
        };
        order: number;
        animation: Animation;
    };
    custom: {
        enabled: boolean;
        value: string;
        autoResize: boolean;
        resizeFactor: number;
        order: number;
        animation: Animation;
    };
    text: {
        enabled: boolean;
        value: string;
        class: string;
        autoResize: boolean;
        resizeFactor: number;
        color: string;
        order: number;
        animation: Animation;
    };
    progress: {
        enabled: boolean;
        class: string;
        autoResize: boolean;
        resizeFactor: number;
        min: number;
        max: number;
        speed: number;
        position: "" | "top" | "bottom";
        margin: string;
        color: string;
        order: number;
    };
    size: {
        value: number;
        units: Units;
    };
    maxSize: number;
    minSize: number;
    direction: string;
    fade: [number, number];
    zIndex: Undefinedable<number>;
};
export default class WaitOverlay {
    private static _deepMerge;
    private static _applyCss;
    private static _createElement;
    private static readonly _defaults;
    private static readonly _validSizes;
    private static readonly _validCSSTime;
    private static readonly _validCSSAnimations;
    private static readonly _validProgressPositions;
    private static readonly _css;
    private static _instance;
    static GetInstance(): WaitOverlay;
    private readonly _states;
    private _settings;
    private constructor();
    Show(options?: Partial<Settings>, container?: Element): void;
    Hide(force?: boolean, container?: Element): void;
    Resize(container?: Element): void;
    Text(value: string | false, container?: Element): void;
    Progress(value: number | false, container?: Element): void;
    Destroy(container?: Element): void;
    Configure(settings: Partial<Settings>): void;
    private _getState;
    private _intervalResize;
    private _cleanup;
    private _applyInlineSvgStyles;
}
export {};
