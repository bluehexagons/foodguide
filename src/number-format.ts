const fractionChars = ['⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** Show signed values with the guide's existing eighth-unit fraction glyphs. */
export function formatSignedValue(input: number | string | undefined): string {
	const value = Number(input);
	if (Number.isNaN(value)) {
		return '';
	}
	const eighths = Math.floor((Math.abs(value) % 1) * 8);
	const fraction = fractionChars[eighths - 1] || '';
	const integer = Math.trunc(value);
	const whole = integer === 0 && value < 0 ? '-0' : integer > 0 ? `+${integer}` : String(integer);
	return whole + fraction;
}
