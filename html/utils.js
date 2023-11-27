export const makeImage = (() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const images = {};
    let requests = [];

    const cacheImage = url => {
        const renderToCache = async (url, imageElement) => {
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(imageElement, 0, 0, 64, 64);
            const blob = await new Promise(done => canvas.toBlob(done, 'image/png'))
            images[url] = URL.createObjectURL(blob);

            requests.filter(request => request.url === url).forEach(request => {
                delete request.img.dataset.pending;

                request.img.src = images[url] || url;
            });

            requests = requests.filter(request => request.url !== url);
        };

        return e => {
            renderToCache(url, e.target);
        }
    };

    const queue = (img, url) => {
        img.dataset.pending = url;
        requests.push({url, img});
    };

    const makeImage = (url, d) => {
        const img = new Image(d)
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='

        img.width = 64;
        img.height = 64;

        if (images[url]) {
            //image is cached
            img.src = images[url];
        } else if (images[url] === null) {
            //image is waiting to be loaded
            queue(img, url, d);
        } else {
            //image has not been cached
            images[url] = null;
            const dummy = new Image();
            dummy.addEventListener('load', cacheImage(url), false);
            dummy.src = url;
            queue(img, url);
        }
        return img;
    };

    canvas.width = 64;
    canvas.height = 64;

    makeImage.queue = queue;

    return makeImage;
})();

export const makeLinkable = (() => {
    const linkSearch = /\[([^\|]*)\|([^\|\]]*)\|?([^\|\]]*)\]/;
    const leftSearch = /([^\|]\]\[[^\|]+\|[^\|\]]+)\|?([^\|\](?:left)]*)(?=\])/g;
    const rightSearch = /(\[[^\|]+\|[^\|\]]+)\|?([^\|\]]*)(?=\]\[)(?!\]\[\|)/g;
    const addLeftClass = (_a, b, c) => { return b + '|' + (c.length === 0 ? 'left' : c + ' left'); };
    const addRightClass = (_a, b, c) => { return b + '|' + (c.length === 0 ? 'right' : c + ' right'); };
    const titleCase = /_(\w)/g;
    const toTitleCase = (_a, b) => { return ' ' + b.toUpperCase(); };

    return str => {
        const processed = str && str.replace(leftSearch, addLeftClass).replace(leftSearch, addLeftClass).replace(rightSearch, addRightClass);
        const results = processed && processed.split(linkSearch);

        if (!results || results.length === 1) {
            return processed;
        } else {
            const fragment = document.createDocumentFragment();
            fragment.appendChild(document.createTextNode(results[0]));

            for (let i = 1; i < results.length; i += 4) {
                if (results[i] === '' && results[i + 1] === '') {
                    fragment.appendChild(document.createElement('br'));
                } else {
                    const span = document.createElement('span');
                    span.className = results[i + 2] === '' ? 'link' : 'link ' + results[i + 2]; //IE doesn't support classList, too lazy to come up with a polyfill
                    span.dataset.link = results[i];

                    if (results[i + 1] && results[i + 1].indexOf('img/') === 0) {
                        span.appendChild(document.createTextNode(results[i + 1].split(' ').slice(1).join(' ')));
                        const url = results[i + 1].split(' ')[0];
                        const image = makeImage(url);
                        image.title = (url.substr(4, 1).toUpperCase() + url.substr(5).replace(titleCase, toTitleCase)).split('.')[0];
                        span.appendChild(image);
                    } else {
                        span.appendChild(document.createTextNode(results[i + 1] ? results[i + 1] : results[i]));
                    }
                    fragment.appendChild(span);
                }

                fragment.appendChild(document.createTextNode(results[i + 3]));
            }

            return fragment;
        }
    };
})();

export const stats = ['hunger', 'health', 'sanity'];
export const isStat = {
    hunger: true,
    health: true,
    sanity: true
};
export const isBestStat = {
    bestHunger: true,
    bestHealth: true,
    bestSanity: true
};

export const pl = (str, n, plr) => {
	return n === 1 ? str : str + (plr || 's');
};
