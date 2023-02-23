module.exports = {
	globDirectory: 'build/',
	globPatterns: [
		'**/*.{ico,png,html,json,txt,js,css}'
	],
	swDest: 'build/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};