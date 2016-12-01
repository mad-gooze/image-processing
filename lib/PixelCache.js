/**
 * Proxifies Image.prototype.getPixel and Image.prototype.getPixelSafe for faster access in repeated reads.
 */
export default class PixelCache {

    constructor(img) {
        this._img = img;
        this.cleanCache();
    }

    cleanCache() {
        this._cache = {};
        this._cacheSafe = {};
        this._cacheZero = {};
    }


    getPixel(x, y) {
        if (!this._cache[y]) this._cache[y] = {};
        if (!this._cache[y][x]) this._cache[y][x] = this._img.getPixel(x, y);
        return this._cache[y][x];
    }

    getPixelSafe(x, y) {
        if (!this._cacheSafe[y]) this._cacheSafe[y] = {};
        if (!this._cacheSafe[y][x]) this._cacheSafe[y][x] = this._img.getPixelSafe(x, y);
        return this._cacheSafe[y][x];
    }

    getPixelZero(x, y) {
        if (!this._cacheZero[y]) this._cacheZero[y] = {};
        if (!this._cacheZero[y][x]) this._cacheZero[y][x] = this._img.getPixelZero(x, y);
        return this._cacheZero[y][x];
    }
}