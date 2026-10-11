import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSignedValue, formatStatGain, percentageGain } from '../html/number-format.js';

test('signed whole numbers and positive fractions retain the existing display format', () => {
	for (const [value, expected] of [
		[0, '0'],
		[2, '+2'],
		[-2, '-2'],
		[2.25, '+2¼'],
		[0.5, '0½'],
	]) {
		assert.equal(formatSignedValue(value), expected);
	}
});

test('negative fractions preserve their sign without adding an extra whole unit', () => {
	for (const [value, expected] of [
		[-2.25, '-2¼'],
		[-0.5, '-0½'],
		[-0.7, '-0⅝'],
		['-10.5', '-10½'],
		[-1.875, '-1⅞'],
	]) {
		assert.equal(formatSignedValue(value), expected);
	}
});

test('missing values stay empty and infinite changes remain available to percentage fallbacks', () => {
	assert.equal(formatSignedValue(undefined), '');
	assert.equal(formatSignedValue('invalid'), '');
	assert.equal(formatSignedValue(Infinity), '+Infinity');
	assert.equal(formatSignedValue(-Infinity), '-Infinity');
});

test('stat gains omit undefined zero-baseline percentages and preserve positive and negative gains', () => {
	for (const [base, value, expected] of [
		[0, 12, '+12'],
		[0, -3, '-3'],
		[0, 0, '0'],
		[-5, 5, '+10 (+200%)'],
		[10, 5, '-5 (-50%)'],
		[10, 10, '0 (0%)'],
		[3, 4, '+1 (+33%)'],
	]) {
		assert.equal(formatStatGain(value - base, percentageGain(base, value)), expected);
	}
	assert.equal(percentageGain(0, 12), null);
	assert.equal(formatStatGain(1, 30_000_000), '+1 (+3000000000%)');
});
