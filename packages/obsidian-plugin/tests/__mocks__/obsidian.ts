/**
 * Mock implementation of Obsidian API for testing
 * Based on obsidian-tasks pattern: https://github.com/obsidian-tasks-group/obsidian-tasks
 *
 * Only mocks the APIs that Quartermaster actually uses.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface CachedMetadata {
    frontmatter?: Record<string, any>;
    links?: LinkCache[];
    embeds?: EmbedCache[];
    tags?: TagCache[];
    headings?: HeadingCache[];
    sections?: SectionCache[];
}

export interface LinkCache {
    link: string;
    original: string;
    displayText?: string;
    position: Pos;
}

export interface EmbedCache {
    link: string;
    original: string;
    displayText?: string;
    position: Pos;
}

export interface TagCache {
    tag: string;
    position: Pos;
}

export interface HeadingCache {
    heading: string;
    level: number;
    position: Pos;
}

export interface SectionCache {
    type: string;
    position: Pos;
}

export interface Pos {
    start: Loc;
    end: Loc;
}

export interface Loc {
    line: number;
    col: number;
    offset: number;
}

// ============================================================================
// File System Types
// ============================================================================

export abstract class TAbstractFile {
    vault: Vault;
    path: string;
    name: string;
    parent: TFolder | null;

    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        this.parent = null;
    }
}

export class TFile extends TAbstractFile {
    stat: FileStats;
    basename: string;
    extension: string;

    constructor(path: string) {
        super(path);
        const parts = this.name.split('.');
        this.extension = parts.length > 1 ? parts.pop()! : '';
        this.basename = parts.join('.');
        this.stat = {
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0,
        };
    }
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[];
    isRoot(): boolean {
        return this.path === '/';
    }

    constructor(path: string) {
        super(path);
        this.children = [];
    }
}

export interface FileStats {
    ctime: number;
    mtime: number;
    size: number;
}

// ============================================================================
// Vault
// ============================================================================

export class Vault {
    private files: Map<string, TFile> = new Map();
    private fileContents: Map<string, string> = new Map();

    // For testing: seed files
    __seedFile(path: string, content: string, frontmatter?: Record<string, any>) {
        const file = new TFile(path);
        this.files.set(path, file);

        if (frontmatter) {
            const yamlContent = '---\n' + Object.entries(frontmatter)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join('\n') + '\n---\n' + content;
            this.fileContents.set(path, yamlContent);
        } else {
            this.fileContents.set(path, content);
        }

        return file;
    }

    getAbstractFileByPath(path: string): TAbstractFile | null {
        return this.files.get(path) || null;
    }

    async read(file: TFile): Promise<string> {
        return this.fileContents.get(file.path) || '';
    }

    async cachedRead(file: TFile): Promise<string> {
        return this.read(file);
    }

    async create(path: string, data: string): Promise<TFile> {
        const file = new TFile(path);
        this.files.set(path, file);
        this.fileContents.set(path, data);
        return file;
    }

    async modify(file: TFile, data: string): Promise<void> {
        this.fileContents.set(file.path, data);
    }

    async delete(file: TFile): Promise<void> {
        this.files.delete(file.path);
        this.fileContents.delete(file.path);
    }

    async rename(file: TFile, newPath: string): Promise<void> {
        const content = this.fileContents.get(file.path) || '';
        this.files.delete(file.path);
        this.fileContents.delete(file.path);

        file.path = newPath;
        file.name = newPath.split('/').pop() || '';
        const parts = file.name.split('.');
        file.extension = parts.length > 1 ? parts.pop()! : '';
        file.basename = parts.join('.');

        this.files.set(newPath, file);
        this.fileContents.set(newPath, content);
    }

    getMarkdownFiles(): TFile[] {
        return Array.from(this.files.values()).filter(f => f.extension === 'md');
    }

    getFiles(): TFile[] {
        return Array.from(this.files.values());
    }

    getAllLoadedFiles(): TAbstractFile[] {
        return Array.from(this.files.values());
    }

    async createFolder(path: string): Promise<void> {
        // No-op for mock
    }

    getRoot(): TFolder {
        return new TFolder('/');
    }
}

// ============================================================================
// Metadata Cache
// ============================================================================

export class MetadataCache {
    private cache: Map<string, CachedMetadata> = new Map();

    // For testing: seed cache
    __seedCache(path: string, metadata: CachedMetadata) {
        this.cache.set(path, metadata);
    }

    getFileCache(file: TFile): CachedMetadata | null {
        return this.cache.get(file.path) || null;
    }

    getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
        // Simple implementation - just try to find the file
        return null;
    }

    on(name: string, callback: (...args: any[]) => void): void {
        // No-op for testing
    }

    off(name: string, callback: (...args: any[]) => void): void {
        // No-op for testing
    }

    trigger(name: string, ...args: any[]): void {
        // No-op for testing
    }
}

// ============================================================================
// App
// ============================================================================

export class App {
    vault: Vault;
    metadataCache: MetadataCache;
    workspace: Workspace;

    constructor() {
        this.vault = new Vault();
        this.metadataCache = new MetadataCache();
        this.workspace = new Workspace();
    }
}

// ============================================================================
// Workspace
// ============================================================================

export class Workspace {
    on(name: string, callback: (...args: any[]) => void): void {}
    off(name: string, callback: (...args: any[]) => void): void {}
    trigger(name: string, ...args: any[]): void {}
    getActiveFile(): TFile | null { return null; }
}

// ============================================================================
// UI Components
// ============================================================================

export class Notice {
    message: string;

    constructor(message: string, timeout?: number) {
        this.message = message;
        // For testing, we might want to capture notices
        if (typeof console !== 'undefined') {
            console.log('[Notice]:', message);
        }
    }

    hide(): void {}
}

export class Modal {
    app: App;
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    modalEl: HTMLElement;

    constructor(app: App) {
        this.app = app;
        this.containerEl = document.createElement('div');
        this.contentEl = document.createElement('div');
        this.modalEl = document.createElement('div');

        // Ensure contentEl has style property for testing
        if (!this.contentEl.style) {
            (this.contentEl as any).style = {};
        }
    }

    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
}

export class Setting {
    settingEl: HTMLElement;
    infoEl: HTMLElement;
    nameEl: HTMLElement;
    descEl: HTMLElement;
    controlEl: HTMLElement;

    constructor(containerEl: HTMLElement) {
        this.settingEl = document.createElement('div');
        this.infoEl = document.createElement('div');
        this.nameEl = document.createElement('div');
        this.descEl = document.createElement('div');
        this.controlEl = document.createElement('div');
    }

    setName(name: string): this { return this; }
    setDesc(desc: string | DocumentFragment): this { return this; }
    addText(cb: (text: TextComponent) => void): this { return this; }
    addTextArea(cb: (text: TextAreaComponent) => void): this { return this; }
    addToggle(cb: (toggle: ToggleComponent) => void): this { return this; }
    addDropdown(cb: (dropdown: DropdownComponent) => void): this { return this; }
    addButton(cb: (button: ButtonComponent) => void): this { return this; }
    addSlider(cb: (slider: SliderComponent) => void): this { return this; }
    setClass(cls: string): this { return this; }
    then(cb: (setting: this) => void): this { cb(this); return this; }
}

// ============================================================================
// Component Types
// ============================================================================

export class TextComponent {
    inputEl: HTMLInputElement;
    private value: string = '';

    constructor() {
        this.inputEl = document.createElement('input');
    }

    getValue(): string { return this.value; }
    setValue(value: string): this { this.value = value; return this; }
    setPlaceholder(placeholder: string): this { return this; }
    onChange(callback: (value: string) => void): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
}

export class TextAreaComponent {
    inputEl: HTMLTextAreaElement;
    private value: string = '';

    constructor() {
        this.inputEl = document.createElement('textarea');
    }

    getValue(): string { return this.value; }
    setValue(value: string): this { this.value = value; return this; }
    setPlaceholder(placeholder: string): this { return this; }
    onChange(callback: (value: string) => void): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
}

export class ToggleComponent {
    toggleEl: HTMLElement;
    private value: boolean = false;

    constructor() {
        this.toggleEl = document.createElement('div');
    }

    getValue(): boolean { return this.value; }
    setValue(value: boolean): this { this.value = value; return this; }
    onChange(callback: (value: boolean) => void): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
}

export class DropdownComponent {
    selectEl: HTMLSelectElement;
    private value: string = '';

    constructor() {
        this.selectEl = document.createElement('select');
    }

    getValue(): string { return this.value; }
    setValue(value: string): this { this.value = value; return this; }
    addOption(value: string, display: string): this { return this; }
    addOptions(options: Record<string, string>): this { return this; }
    onChange(callback: (value: string) => void): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
}

export class ButtonComponent {
    buttonEl: HTMLButtonElement;

    constructor() {
        this.buttonEl = document.createElement('button');
    }

    setButtonText(text: string): this { return this; }
    setIcon(icon: string): this { return this; }
    setTooltip(tooltip: string): this { return this; }
    setCta(): this { return this; }
    setWarning(): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
    onClick(callback: () => void): this { return this; }
}

export class SliderComponent {
    sliderEl: HTMLInputElement;
    private value: number = 0;

    constructor() {
        this.sliderEl = document.createElement('input');
        this.sliderEl.type = 'range';
    }

    getValue(): number { return this.value; }
    setValue(value: number): this { this.value = value; return this; }
    setLimits(min: number, max: number, step: number): this { return this; }
    setDynamicTooltip(): this { return this; }
    onChange(callback: (value: number) => void): this { return this; }
    setDisabled(disabled: boolean): this { return this; }
}

// ============================================================================
// HTMLElement Extensions (Obsidian-specific)
// ============================================================================

// Extend HTMLElement with Obsidian's custom methods
declare global {
    interface HTMLElement {
        createEl<K extends keyof HTMLElementTagNameMap>(
            tag: K,
            o?: string | DomElementInfo,
            callback?: (el: HTMLElementTagNameMap[K]) => void
        ): HTMLElementTagNameMap[K];
        createDiv(o?: string | DomElementInfo, callback?: (el: HTMLDivElement) => void): HTMLDivElement;
        createSpan(o?: string | DomElementInfo, callback?: (el: HTMLSpanElement) => void): HTMLSpanElement;
        empty(): void;
    }

    interface String {
        contains(search: string): boolean;
    }

    interface HTMLInputElement {
        trigger(eventName: string): void;
    }
}

export interface DomElementInfo {
    text?: string;
    cls?: string | string[];
    attr?: Record<string, string>;
    title?: string;
    parent?: HTMLElement;
}

// Implement the extensions
if (typeof HTMLElement !== 'undefined') {
    HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
        tag: K,
        o?: string | DomElementInfo,
        callback?: (el: HTMLElementTagNameMap[K]) => void
    ): HTMLElementTagNameMap[K] {
        const el = document.createElement(tag);

        // Ensure style property exists for testing (jsdom may not initialize it)
        if (!el.style || typeof el.style !== 'object') {
            Object.defineProperty(el, 'style', {
                value: {},
                writable: true,
                configurable: true
            });
        }

        if (typeof o === 'string') {
            el.textContent = o;
        } else if (o) {
            if (o.text) el.textContent = o.text;
            if (o.cls) {
                const classes = Array.isArray(o.cls) ? o.cls : [o.cls];
                el.classList.add(...classes);
            }
            if (o.attr) {
                Object.entries(o.attr).forEach(([key, value]) => el.setAttribute(key, value));
            }
            if (o.title) el.title = o.title;
        }

        this.appendChild(el);

        if (callback) callback(el);

        return el;
    };

    HTMLElement.prototype.createDiv = function (
        o?: string | DomElementInfo,
        callback?: (el: HTMLDivElement) => void
    ): HTMLDivElement {
        const el = this.createEl('div', o, callback);
        // Ensure style property exists for testing
        if (!el.style) {
            (el as any).style = {};
        }
        return el;
    };

    HTMLElement.prototype.createSpan = function (
        o?: string | DomElementInfo,
        callback?: (el: HTMLSpanElement) => void
    ): HTMLSpanElement {
        const el = this.createEl('span', o, callback);
        // Ensure style property exists for testing
        if (!el.style) {
            (el as any).style = {};
        }
        return el;
    };

    HTMLElement.prototype.empty = function (): void {
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }
    };

    // Add addClass, removeClass, toggleClass methods (Obsidian extensions)
    (HTMLElement.prototype as any).addClass = function (cls: string): HTMLElement {
        this.classList.add(cls);
        return this;
    };

    (HTMLElement.prototype as any).removeClass = function (cls: string): HTMLElement {
        this.classList.remove(cls);
        return this;
    };

    (HTMLElement.prototype as any).toggleClass = function (cls: string, value?: boolean): HTMLElement {
        if (value === undefined) {
            this.classList.toggle(cls);
        } else if (value) {
            this.classList.add(cls);
        } else {
            this.classList.remove(cls);
        }
        return this;
    };

    // Add setText method (Obsidian extension)
    (HTMLElement.prototype as any).setText = function (text: string): HTMLElement {
        this.textContent = text;
        return this;
    };

    // Add trigger method to HTMLInputElement
    if (typeof HTMLInputElement !== 'undefined') {
        (HTMLInputElement.prototype as any).trigger = function (eventName: string): void {
            const event = new Event(eventName, { bubbles: true, cancelable: true });
            this.dispatchEvent(event);
        };
    }

    // Add contains method to String
    if (typeof String !== 'undefined') {
        (String.prototype as any).contains = function (search: string): boolean {
            return this.indexOf(search) !== -1;
        };
    }
}

// ============================================================================
// Plugin Types
// ============================================================================

export abstract class Plugin {
    app: App;
    manifest: PluginManifest;

    constructor(app: App, manifest: PluginManifest) {
        this.app = app;
        this.manifest = manifest;
    }

    async loadData(): Promise<any> { return {}; }
    async saveData(data: any): Promise<void> {}

    addCommand(command: Command): Command { return command; }
    addSettingTab(settingTab: PluginSettingTab): void {}
    addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement {
        return document.createElement('div');
    }

    registerEvent(eventRef: any): void {}
    registerInterval(id: number): number { return id; }
}

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    minAppVersion: string;
    description: string;
    author: string;
    authorUrl?: string;
    isDesktopOnly?: boolean;
}

export abstract class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl: HTMLElement;

    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
    }

    display(): void {}
    hide(): void {}
}

export interface Command {
    id: string;
    name: string;
    icon?: string;
    mobileOnly?: boolean;
    callback?: () => void;
    checkCallback?: (checking: boolean) => boolean | void;
    editorCallback?: (editor: any, view: any) => void;
    editorCheckCallback?: (checking: boolean, editor: any, view: any) => boolean | void;
}

// ============================================================================
// Suggest Components
// ============================================================================

export abstract class AbstractInputSuggest<T> {
    app: App;
    inputEl: HTMLInputElement;
    protected suggestEl: HTMLElement | null = null;
    protected suggestions: T[] = [];

    constructor(app: App, inputEl: HTMLInputElement) {
        this.app = app;
        this.inputEl = inputEl;
    }

    abstract getSuggestions(query: string): T[];
    abstract renderSuggestion(item: T, el: HTMLElement): void;
    abstract selectSuggestion(item: T): void;

    open(): void {
        this.suggestEl = document.createElement('div');
        this.suggestEl.className = 'suggestion-container';
    }

    close(): void {
        this.suggestEl = null;
        this.suggestions = [];
    }

    setValue(value: string): void {
        this.inputEl.value = value;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function parseFrontMatterAliases(frontmatter: any): string[] | null {
    if (!frontmatter) return null;
    const aliases = frontmatter.aliases || frontmatter.alias;
    if (!aliases) return null;
    return Array.isArray(aliases) ? aliases : [aliases];
}

export function parseFrontMatterTags(frontmatter: any): string[] | null {
    if (!frontmatter) return null;
    const tags = frontmatter.tags || frontmatter.tag;
    if (!tags) return null;
    return Array.isArray(tags) ? tags : [tags];
}

// ============================================================================
// Default Export (for CommonJS compatibility)
// ============================================================================

export default {
    App,
    Vault,
    TFile,
    TFolder,
    TAbstractFile,
    MetadataCache,
    Notice,
    Modal,
    Setting,
    Plugin,
    PluginSettingTab,
    TextComponent,
    TextAreaComponent,
    ToggleComponent,
    DropdownComponent,
    ButtonComponent,
    SliderComponent,
    AbstractInputSuggest,
    normalizePath,
    parseFrontMatterAliases,
    parseFrontMatterTags,
};
