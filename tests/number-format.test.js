import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSignedValue } from '../html/number-format.js';

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
