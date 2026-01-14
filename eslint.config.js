export default [
	{
		rules: {
			// Basic formatting
			semi: 'error',
			'prefer-const': 'error',
			indent: ['error', 'tab'],
			quotes: ['error', 'single', { avoidEscape: true }],
			'arrow-parens': ['error', 'as-needed'],
			'comma-dangle': ['error', 'always-multiline'],
			
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-console': 'off',
			'no-debugger': 'warn',
			'eqeqeq': 'warn',
			'curly': 'error',
			
			'prefer-arrow-callback': 'warn',
			'prefer-template': 'warn',
			'object-shorthand': 'warn',
			
			'no-dupe-keys': 'warn',
			'no-prototype-builtins': 'warn',
			'no-useless-escape': 'warn',
			
			'no-undef': 'off',
		},
	},
];
