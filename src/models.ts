/** Types shared by the library, calculator, and browser UI. */
export type PreparationType = 'raw' | 'cooked' | 'dried' | 'recipe';
export type Stat = 'health' | 'hunger' | 'sanity';
export type BestStat = 'bestHealth' | 'bestHunger' | 'bestSanity';
export type StatMultipliers = Record<PreparationType, number>;
export type IngredientNames = Record<string, number>;
export type IngredientTags = Record<string, number>;
export type TextParams = Record<string, string | number>;
export type Linkable = string | DocumentFragment;

export interface ModeDefinition {
	name: string;
	img: string;
	bit: number;
	mask?: number;
	charBit?: number;
	color?: string;
}
export interface CharacterDefinition {
	name: string;
	img: string;
	bit: number;
	applicableModes: string[];
	multipliers?: Record<string, Partial<StatMultipliers>>;
	abilities?: {
		noMonsterPenalty?: boolean;
		rawMeatIsCooked?: boolean;
		meatOnly?: boolean;
		canEatGoodies?: boolean;
	};
}
export interface Quantity {
	op?: string;
	qty?: number;
	test: (qty: number) => boolean;
	toString: () => string;
}
export type RequirementTest = (
	cooker: unknown,
	names: IngredientNames,
	tags: IngredientTags,
) => boolean | number | undefined;
export interface Requirement {
	test: RequirementTest;
	toString: () => string;
	operator?: 'and' | 'or' | 'not';
	cancel?: boolean;
	name?: string;
	tag?: string;
	qty?: Quantity;
	item?: Requirement;
	item1?: Requirement;
	item2?: Requirement;
}

export interface ItemProperties {
	name: string;
	health?: number;
	hunger?: number;
	sanity?: number;
	perish?: number;
	mode?: string;
	vanilla?: boolean;
	giants?: boolean;
	shipwrecked?: boolean;
	hamlet?: boolean;
	together?: boolean;
	warly?: boolean;
	warlydst?: boolean;
	foodtype?: string;
	monster?: number | boolean;
	sweetener?: number | boolean;
	ismeat?: boolean;
	uncookable?: boolean;
	defaultExclude?: boolean;
	note?: string;
	noteKey?: import('./strings.js').StringKey;
	noteParams?: TextParams;
	basename?: string;
}
export interface FoodProperties extends ItemProperties {
	meat?: number;
	veggie?: number;
	fruit?: number;
	egg?: number;
	fish?: number;
	magic?: number;
	decoration?: number;
	inedible?: number;
	fat?: number;
	dairy?: number;
	jellyfish?: number;
	antihistamine?: number;
	filter?: number;
	bug?: number;
	bone?: number;
	roughage?: number | boolean;
	seed?: number;
	frozen?: number;
	dried?: number;
	precook?: number;
	stack?: number;
	isveggie?: boolean;
	isfruit?: boolean;
	isfrozen?: boolean;
	isbone?: boolean;
	cooked?: boolean;
	rackdried?: boolean;
	ideal?: boolean;
	skip?: boolean;
	rot?: string;
	drytime?: number;
	comment?: string;
}
/** Authored definitions use IDs for preparation links, before initialization. */
export interface FoodDefinition extends FoodProperties {
	cook?: string;
	raw?: string;
	dry?: string;
	wet?: string;
	preparationType?: PreparationType;
	modes?: string[];
	modeOverrides?: Record<string, FoodModeOverride>;
}
/** In mode overrides, false removes a property instead of assigning a value. */
export type FoodModeOverride = {
	[K in keyof Omit<FoodDefinition, 'modeOverrides' | 'modes'>]?: FoodDefinition[K] | false;
};
export interface InitializedItem extends ItemProperties {
	id: string;
	key: string;
	img: string;
	lowerName: string;
	match: number;
	mode: string;
	modeMask: number;
	charMask: number;
	modeNode?: Linkable;
	preparationType: PreparationType;
}
export interface Food extends Omit<FoodProperties, keyof InitializedItem>, InitializedItem {
	cook?: Food;
	raw?: Food;
	dry?: Food;
	wet?: Food;
	nameObject: IngredientNames;
	bestHealth: number;
	bestHunger: number;
	bestSanity: number;
	bestHealthType: PreparationType;
	bestHungerType: PreparationType;
	bestSanityType: PreparationType;
	recipes?: Recipe[];
	ingredient?: boolean;
	info?: Linkable;
}
export interface RecipeDefinition extends ItemProperties {
	test: RequirementTest;
	requirements: Requirement[];
	priority: number;
	cooktime: number;
	temperature?: number;
	temperatureduration?: number;
	temperaturebump?: number;
	tags?: string[];
	weight?: number;
	trash?: boolean;
	rot?: string;
	requires?: Linkable;
}
export interface Recipe extends Omit<RecipeDefinition, keyof InitializedItem>, InitializedItem {
	baseNote: string;
	weight: number;
}
export type GuideItem = Food | Recipe;
/** Array-like keyed collections retain the historical JavaScript API. */
export type Collection<T extends { lowerName: string }> = Record<string, T> & {
	[index: number]: T;
	length: number;
	forEach: (
		callback: (item: T, index: number, collection: Collection<T>) => void,
		thisArg?: unknown,
	) => void;
	filter: (
		predicate: (item: T, index: number, collection: Collection<T>) => unknown,
		thisArg?: unknown,
	) => T[];
	sort: (compare?: (a: T, b: T) => number) => Collection<T>;
	byName: (name: string) => T | undefined;
};
export type FoodCollection = Collection<Food>;
export type RecipeCollection = Collection<Recipe>;
export type ItemModifiers = Partial<Record<Stat, number>>;
export type ModifyItem = (item: GuideItem, modeMask: number) => ItemModifiers;
export interface CalculatorOptions {
	getModeMask: () => number;
	getCharMask: () => number;
	getStatMultipliers: () => StatMultipliers;
}
export interface SummaryRow {
	name: 'Sum:Total' | 'Sum:Potential';
	img: string;
	priority: string;
	perish: number;
	cooktime: number;
	health: number;
	hunger: number;
	sanity: number;
	bestHealth?: number;
	bestHunger?: number;
	bestSanity?: number;
}
export type CalculatorRow = Recipe | SummaryRow;

export interface SpriteManifest {
	cellSize: number;
	columns: number;
	rows: number[];
	sheets: string[];
	images: Record<string, { sheet: number; col: number; row: number }>;
}

export interface AnalysisResult {
	recipe: Recipe;
	ingredients: Food[];
	tags: { health: number; hunger: number };
	multiple: boolean;
}
export interface RecipeData {
	recipes: Recipe[];
	test: RequirementTest[];
	tests: string[];
	priority: number[];
}
export interface AnalysisRow extends AnalysisResult {
	name: string;
	health: number;
	hunger: number;
	sanity?: number;
	perish?: number;
	ihealth: number;
	ihunger: number;
	healthpls: number;
	hungerpls: number;
	healthpct: number;
	hungerpct: number;
}
