export const makeImage = (() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const canvas32 = document.createElement('canvas');
    const ctx32 = canvas32.getContext && canvas32.getContext('2d');
    const images = {};
    const images32 = {};
    let requests = [];
    const cacheImage = url => {
        const renderToCache = (url, imageElement) => {
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(imageElement, 0, 0, 64, 64);
            ctx32.clearRect(0, 0, 32, 32);
            ctx32.drawImage(imageElement, 0, 0, 32, 32);
            images[url] = canvas.toDataURL();
            images32[url] = canvas32.toDataURL();
            requests.filter(request => { return request.url === url; }).forEach(request => {
                if (request.url === url) {
                    delete request.img.dataset.pending;
                    request.img.removeAttribute('data-pending');
                    if (request.d === 32) {
                        request.img.src = images32[url] || url;
                    } else {
                        request.img.src = images[url] || url;
                    }
                }
            });
            requests = requests.filter(request => { return request.url !== url; });
        };
        return e => {
            renderToCache(url, e.target);
        }
    };
    const queue = (img, url, d) => {
        img.dataset.pending = url;
        img.setAttribute('data-pending', url);
        requests.push({url: url, img: img, d: d});
    };
    const makeImage = (url, d) => {
        const img = new Image(d)
        if (images[url]) {
            //image is cached
            if (d === 32) {
                img.src = images32[url];
            } else {
                img.src = images[url];
            }
        } else if (images[url] === null) {
            //image is waiting to be loaded
            queue(img, url, d);
        } else {
            //image has not been cached
            images[url] = null;
            const dummy = new Image();
            dummy.addEventListener('load', cacheImage(url), false);
            dummy.src = url;
            queue(img, url, d);
        }
        return img;
    };
    canvas.width = 64;
    canvas.height = 64;
    canvas32.width = 32;
    canvas32.height = 32;
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
                        const image = makeImage(url, 32);
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
