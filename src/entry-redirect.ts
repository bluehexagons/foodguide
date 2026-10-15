// Keep copied section links intact when opening the legacy index.htm entry point.
(() => {
	const destination = new URL(
		window.location.protocol === 'file:' ? 'index.html' : './',
		window.location.href,
	);
	destination.search = window.location.search;
	destination.hash = window.location.hash;
	window.location.replace(destination.href);
})();
