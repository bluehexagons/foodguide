// Keep copied section links intact when a host serves the index.html entry stub.
(() => {
	const destination = new URL('index.htm', window.location.href);
	destination.search = window.location.search;
	destination.hash = window.location.hash;
	window.location.replace(destination.href);
})();
