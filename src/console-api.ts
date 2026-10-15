import type {
	AnalysisProgress,
	AnalysisRow,
	FoodCollection,
	RecipeCollection,
	StatMultipliers,
} from './models.js';
import type { GameSelection } from './preferences.js';
import type { GuideTab } from './navigation.js';
import type { createRecipeCalculator } from './recipe-calculator.js';

export type AnalysisSource = 'statistics' | 'discovery';
type AnalysisStatus = 'running' | 'paused' | 'complete';
interface AnalysisContext {
	selection: GameSelection;
	modeMask: number;
	charMask: number;
	multipliers: StatMultipliers;
	ingredients: string[];
}
type ConsoleRow = Omit<AnalysisRow, 'recipe' | 'ingredients' | 'tags'> & {
	recipe: string;
	ingredients: string[];
};
interface RowQuery {
	offset?: number;
	limit?: number;
	filtered?: boolean;
}

/** Inspect UI-owned results without building a second result set or retaining cleared runs. */
export function createAnalysisInspector() {
	const runs = new Map<
		AnalysisSource,
		{
			context: AnalysisContext;
			status: AnalysisStatus;
			progress: AnalysisProgress;
			rows: AnalysisRow[];
			matches: (row: AnalysisRow) => boolean;
		}
	>();
	const copyContext = (context: AnalysisContext) => ({
		...context,
		selection: { ...context.selection, dlc: { ...context.selection.dlc } },
		multipliers: { ...context.multipliers },
		ingredients: [...context.ingredients],
	});
	return {
		register(
			source: AnalysisSource,
			context: AnalysisContext,
			rows: AnalysisRow[],
			matches: (row: AnalysisRow) => boolean,
		) {
			const run = {
				context: copyContext(context),
				rows,
				matches,
				status: 'running' as AnalysisStatus,
				progress: { checked: 0, total: 0 },
			};
			runs.set(source, run);
			return {
				update(progress: AnalysisProgress, status: AnalysisStatus = run.status) {
					run.progress = { ...progress };
					run.status = status;
				},
				clear() {
					if (runs.get(source) === run) {
						runs.delete(source);
					}
				},
			};
		},
		summaries() {
			return [...runs].map(([source, run]) => ({
				source,
				...copyContext(run.context),
				status: run.status,
				...run.progress,
				resultCount: run.rows.length,
			}));
		},
		rows(source: AnalysisSource, { offset = 0, limit = 100, filtered = false }: RowQuery = {}) {
			if (
				!Number.isSafeInteger(offset) ||
				offset < 0 ||
				!Number.isSafeInteger(limit) ||
				limit < 0 ||
				limit > 10_000
			) {
				throw new RangeError(
					'Use a nonnegative integer offset and a limit from 0 to 10000.',
				);
			}
			const run = runs.get(source);
			const page: ConsoleRow[] = [];
			if (!run || !limit) {
				return page;
			}
			let skipped = 0;
			for (let index = filtered ? 0 : offset; index < run.rows.length; index++) {
				const row = run.rows[index];
				if (filtered && !run.matches(row)) {
					continue;
				}
				if (filtered && skipped++ < offset) {
					continue;
				}
				const { recipe, ingredients, tags: _tags, ...stats } = row;
				page.push({
					...stats,
					recipe: recipe.key,
					ingredients: ingredients.map(item => item.key),
				});
				if (page.length >= limit) {
					break;
				}
			}
			return page;
		},
	};
}

export interface GuideConsole {
	food: FoodCollection;
	recipes: RecipeCollection;
	matchingNames: ReturnType<typeof createRecipeCalculator>['matchingNames'];
	getRecipes: ReturnType<typeof createRecipeCalculator>['getRecipes'];
	getSuggestions: ReturnType<typeof createRecipeCalculator>['getSuggestions'];
	getState: () => {
		tab: GuideTab;
		selection: GameSelection;
		pot: (string | null)[];
		inventory: string[];
	};
	analyses: ReturnType<typeof createAnalysisInspector>['summaries'];
	analysisRows: ReturnType<typeof createAnalysisInspector>['rows'];
}
