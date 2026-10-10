const fractionChars = ['⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** A zero baseline has no meaningful relative percentage. */
export function percentageGain(base: number, value: number): number | null {
	if (base === 0) {
		return null;
	}
	const gain = (value - base) / Math.abs(base);
	return Number.isFinite(gain) ? gain : null;
}

export function formatStatGain(gain: number, percentage: number | null): string {
	const value = formatSignedValue(gain);
	return percentage === null
		? value
		: `${value} (${formatSignedValue(Math.trunc(percentage * 100))}%)`;
}

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
