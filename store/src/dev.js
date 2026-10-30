// Testing switches in the URL (?quick, ?scene=, ?day=+1, ?qa=god …) only work
// when the store is served from this computer, so shoppers on the live site
// can't skip secrets, replay tomorrow's rewards, or turn on invincibility.
const host = typeof location !== 'undefined' ? location.hostname : '';
export const DEV = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
export const devParams = new URLSearchParams(DEV ? location.search : '');
