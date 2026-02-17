import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	{
		rules: {
			// Code quality rules (non-formatting)
			'prefer-const': 'error',
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-console': 'off',
			'no-debugger': 'warn',
			eqeqeq: 'warn',
			curly: 'error',

			'prefer-arrow-callback': 'warn',
			'prefer-template': 'warn',
			'object-shorthand': 'warn',

			'no-dupe-keys': 'warn',
			'no-prototype-builtins': 'warn',
			'no-useless-escape': 'warn',

			'no-undef': 'off',
		},
	},
	// Disable ESLint formatting rules that conflict with Prettier
	eslintConfigPrettier,
];
