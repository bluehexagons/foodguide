import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
	food,
	recipes,
	itemName,
	localizedName,
	registerLocale,
	setLocale,
	TOGETHER,
	defaultStatMultipliers,
} from '../html/foodguide-data.js';
import { dict as spanish } from '../html/locales/es.js';
import { dict as chinese } from '../html/locales/zh.js';
import { dict as russian } from '../html/locales/ru.js';
import { dict as brazilian } from '../html/locales/pt-BR.js';
import { createRecipeCalculator } from '../html/recipe-calculator.js';
import { sortIngredients } from '../html/ingredient-sort.js';
import { compareItemNames } from '../html/table-sort.js';
import { AND, COMPARE, NAME, SPECIFIC, TAG } from '../html/functions.js';
import { updateFoodRecipes, updateRecipeText } from '../html/recipes.js';
import { tagLabel } from '../html/strings.js';

afterEach(() => setLocale('en'));

test('bundled name dictionaries cover every food, recipe, and static game name', () => {
	const document = readFileSync(new URL('../html/index.html', import.meta.url), 'utf8');
	const staticNames = [...document.matchAll(/data-i18n-name="([^"]+)"/g)].map(match => match[1]);
	const names = [
		...food.filter(() => true).map(item => item.name),
		...recipes.filter(() => true).map(item => item.name),
		...staticNames,
	];
	for (const [locale, dict] of [
		['es', spanish],
		['zh', chinese],
		['ru', russian],
		['pt-BR', brazilian],
	]) {
		for (const name of names) {
			assert.ok(Object.hasOwn(dict.names, name), `${locale}: missing ${name}`);
			assert.ok(dict.names[name].trim(), `${locale}: empty ${name}`);
		}
	}
});

test('game names translate at display time while canonical data stays stable', () => {
	const items = [...food.filter(() => true), ...recipes.filter(() => true)];
	const canonical = () =>
		items.map(({ name, lowerName, id, key, img }) => ({ name, lowerName, id, key, img }));
	const before = canonical();
	setLocale('es');
	assert.equal(itemName(food.carrot), 'Zanahoria');
	assert.equal(itemName(recipes.meatballs), 'Albóndigas');
	assert.equal(itemName(recipes.pumpkincookie_dst), 'Galletas de calabaza');
	assert.equal(itemName(food.radish), 'Rábano');
	setLocale('zh');
	assert.equal(itemName(food.carrot), '胡萝卜');
	assert.equal(itemName(recipes.meatballs), '肉丸');
	assert.equal(itemName(recipes.pumpkincookie_dst), '南瓜饼干');
	assert.equal(localizedName('Webber'), '韦伯');
	assert.equal(localizedName('Shipwrecked'), '海难');
	setLocale('ru');
	assert.equal(itemName(food.carrot), 'Морковь');
	assert.equal(itemName(recipes.meatballs), 'Тефтели');
	assert.equal(itemName(recipes.pumpkincookie_dst), 'Тыквенные печеньки');
	assert.equal(itemName(food.fish), 'Рыба');
	assert.equal(localizedName('Warly (DST)'), 'Варли (DST)');
	setLocale('pt-BR');
	assert.equal(itemName(food.carrot), 'Cenoura');
	assert.equal(itemName(recipes.meatballs), 'Almôndegas');
	assert.equal(itemName(recipes.pumpkincookie_dst), 'Biscoitinhos de abóbora');
	assert.equal(itemName(food.fish), 'Peixe');
	assert.deepEqual(canonical(), before);
	setLocale('en');
	assert.equal(itemName(food.carrot), 'Carrot');
});

test('partial custom name dictionaries fall back safely to canonical English', () => {
	registerLocale('x-names', 'Test', { names: { Carrot: 'CARROTX' } });
	setLocale('x-names');
	assert.equal(itemName(food.carrot), 'CARROTX');
	assert.equal(itemName(food.meat), 'Meat');
	assert.equal(localizedName('constructor'), 'constructor');
	assert.equal(localizedName('__proto__'), '__proto__');
	assert.ok(compareItemNames(food.carrot, food.meat) < 0);
	assert.deepEqual(
		sortIngredients([food.meat, food.carrot], 'name', {
			statMultipliers: defaultStatMultipliers,
			modifyItem: () => ({}),
			modeMask: TOGETHER,
		}).map(item => item.id),
		['carrot', 'meat'],
	);
});

test('localized searches accept accents, Chinese substrings, English, and prefab IDs', () => {
	const { matchingNames } = createRecipeCalculator({
		getModeMask: () => TOGETHER,
		getCharMask: () => 0,
		getStatMultipliers: () => defaultStatMultipliers,
	});
	setLocale('es');
	assert.equal(matchingNames(food, '*zanahoria')[0].id, 'carrot');
	assert.equal(matchingNames(recipes, '*albondigas')[0].id, 'meatballs_dst');
	assert.ok(
		matchingNames(food, 'recipe:magdalena de mariposa').some(
			item => item.id === 'butterflywings',
		),
	);
	assert.ok(
		matchingNames(food, 'recipe:butter muffin').some(item => item.id === 'butterflywings'),
	);
	setLocale('zh');
	assert.equal(matchingNames(food, '*胡萝卜')[0].id, 'carrot');
	assert.ok(matchingNames(food, '萝卜').some(item => item.id === 'carrot'));
	assert.ok(matchingNames(food, '~胡萝卜').some(item => item.id === 'carrot_cooked'));
	assert.ok(matchingNames(food, 'recipe:蝴蝶松饼').some(item => item.id === 'butterflywings'));
	assert.ok(matchingNames(recipes, 'ingredient:胡萝卜').length > 0);
	assert.equal(matchingNames(food, '*carrot')[0].id, 'carrot');
	assert.ok(matchingNames(food, 'red_mushroom').some(item => item.id === 'red_mushroom'));
	assert.ok(matchingNames(food, 'tag:meat').every(item => item.meat));
	assert.deepEqual(matchingNames(food, '['), []);
	setLocale('ru');
	assert.equal(matchingNames(food, '*морковь')[0].id, 'carrot');
	assert.equal(matchingNames(recipes, '*тефтели')[0].id, 'meatballs_dst');
	assert.ok(matchingNames(recipes, 'ingredient:морковь').length > 0);
	assert.ok(
		matchingNames(food, 'recipe:маффин из бабочки').some(item => item.id === 'butterflywings'),
	);
	assert.equal(matchingNames(food, '*carrot')[0].id, 'carrot');
	setLocale('pt-BR');
	assert.equal(matchingNames(food, '*cenoura')[0].id, 'carrot');
	assert.equal(matchingNames(recipes, '*almondegas')[0].id, 'meatballs_dst');
	assert.equal(matchingNames(food, '*abobora')[0].id, 'pumpkin');
	assert.ok(matchingNames(recipes, 'ingredient:cenoura').length > 0);
	assert.ok(
		matchingNames(food, 'recipe:bolinho de manteiga').some(
			item => item.id === 'butterflywings',
		),
	);
	assert.equal(matchingNames(food, '*carrot')[0].id, 'carrot');
});

test('localized name sorting and requirements retain canonical link payloads', () => {
	setLocale('es');
	assert.ok(compareItemNames(food.meat, food.carrot) < 0);
	assert.deepEqual(
		sortIngredients([food.carrot, food.meat], 'name', {
			statMultipliers: defaultStatMultipliers,
			modifyItem: () => ({}),
			modeMask: TOGETHER,
		}).map(item => item.id),
		['meat', 'carrot'],
	);
	const requirement = String(AND(NAME('carrot'), SPECIFIC('meat')));
	assert.match(requirement, /\[\*Carrot\|img\/carrot\.png Zanahoria\]/);
	assert.match(requirement, / y /);
	setLocale('zh');
	assert.match(String(NAME('carrot')), /\[\*Carrot\|img\/carrot\.png 胡萝卜\]/);
	setLocale('ru');
	assert.match(String(NAME('carrot')), /\[\*Carrot\|img\/carrot\.png Морковь\]/);
	assert.ok(compareItemNames(food.carrot, food.meat) < 0);
	setLocale('pt-BR');
	assert.match(String(NAME('carrot')), /\[\*Carrot\|img\/carrot\.png Cenoura\]/);
	assert.ok(compareItemNames(food.meat, food.carrot) < 0);
});

test('fractional requirements and ingredient tag weights use locale decimals without changing data', () => {
	const threshold = COMPARE('>', 1.5);
	try {
		for (const [locale, decimal] of [
			['en', '.'],
			['es', ','],
			['zh', '.'],
			['ru', ','],
			['pt-BR', ','],
		]) {
			setLocale(locale);
			updateRecipeText();
			updateFoodRecipes(recipes);
			const meat = `[tag:meat|${tagLabel('meat')}]`;
			assert.equal(String(TAG('meat', threshold)), `${meat}>1${decimal}5`);
			assert.equal(String(COMPARE('<=', 0.5)), `<=0${decimal}5`);
			assert.ok(recipes.honeyham.requires.includes(`${meat}>1${decimal}5`));
			for (const [id, tag, weight] of [
				['morsel', 'meat', `0${decimal}5`],
				['berries', 'fruit', `0${decimal}5`],
				['red_mushroom', 'veggie', `0${decimal}5`],
				['limpets', 'fish', `0${decimal}5`],
				['tallbirdegg', 'egg', '4'],
			]) {
				assert.ok(food[id].info.includes(`[tag:${tag}|${tagLabel(tag)}]×${weight}`));
			}
			assert.equal(threshold.qty, 1.5);
			assert.equal(threshold.test(1.5), false);
			assert.equal(threshold.test(2), true);
			assert.equal(food.morsel.meat, 0.5);
		}
	} finally {
		setLocale('en');
		updateRecipeText();
		updateFoodRecipes(recipes);
	}
});
