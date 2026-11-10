import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let commit = 'unknown';
try {
	const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim();
	if (realpathSync(top) !== realpathSync(root)) {
		throw new Error('Not a guide checkout');
	}
	commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim();
} catch {
	// Source archives do not necessarily contain Git metadata.
}
const label = `Food Guide ${version} (${commit})`;
writeFileSync(
	new URL('../html/version.js', import.meta.url),
	`document.getElementById('build-version').textContent = ${JSON.stringify(label)};\n`,
);
