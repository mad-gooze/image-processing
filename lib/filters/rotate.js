import Image from '../Image';
import PixelCache from '../PixelCache';
import {sumPixel} from '../Utils';

// TODO: refactor _rotate functions

export function _rotateHalfPI() {
    const tmp = new Image(this.height, this.width, this.imageType);
    this.forEachPixel((x, y) => tmp.setPixel(y, x, this.getPixel(this.width - x - 1, y)));
    this._data = tmp._data;
    this._width = tmp._width;
    this._height = tmp._height;
    return this;
}

export function _rotatePI() {
    const tmp = new Image(this.width, this.height, this.imageType);
    this.forEachPixel((x, y) => tmp.setPixel(x, y, this.getPixel(this.width - x - 1, this.height - y - 1)));
    this._data = tmp._data;
    return this;
}

export function _rotate3HalfPI() {
    const tmp = new Image(this.height, this.width, this.imageType);
    this.forEachPixel((x, y) => tmp.setPixel(y, x, this.getPixel(x, this.height - y - 1)));
    this._data = tmp._data;
    this._width = tmp._width;
    this._height = tmp._height;
    return this;
}

export function rotate(angle) {

    if (angle === 0) {
        return this;
    } else if (angle === 90) {
        return this._rotateHalfPI();
    } else if (angle === 180) {
        return this._rotateHalfPI();
    } else if (angle === 270) {
        return this._rotate3HalfPI();
    } else {
        angle %= 360;
        if (angle < 0) {
            angle += 360;
        }
        const rads = angle * Math.PI / 180;
        const quadrant = Math.floor((angle/90) % 4);

        const rotRads = [
            rads,
            Math.PI - rads,
            rads - Math.PI,
            2 * Math.PI - rads
        ][quadrant];

        const width = Math.round(this.width * Math.cos(rotRads) + this.height * Math.sin(rotRads));
        const height = Math.round(this.width * Math.sin(rotRads) + this.height * Math.cos(rotRads));
        const tmp = new Image(width, height, this.imageType);

        const sin = Math.sin(rads);
        const cos = Math.cos(rads);

        const x0 = this.width / 2;
        const y0 = this.height / 2;
        const newX0 = tmp.width / 2;
        const newY0 = tmp.height / 2;

        const pixelCache = new PixelCache(this);

        tmp.forEachPixel((x, y) => {
            const deltaX = x - newX0;
            const deltaY = y - newY0;

            const oldX = deltaX * cos - deltaY * sin + x0;
            const oldY = deltaX * sin + deltaY * cos + y0;

            if (oldX < 0 || oldX > this.width || oldY < 0 || oldY > this.height) {
                return;
            }

            const x1 = Math.floor(oldX);
            const x2 = Math.ceil(oldX);

            const y1 = Math.floor(oldY);
            const y2 = Math.ceil(oldY);

            if (x1 === x2 || y1 === y2) {
                tmp.setPixel(x, y, pixelCache.getPixel(x1, y1));
            } else {
                const weight = (x2 - x1) * (y2 - y1);
                const sum = new Float64Array(this.channelsNumber);
                sumPixel(pixelCache.getPixelZero(x1, y1), (x2 - oldX) * (y2 - oldY) / weight, sum);
                sumPixel(pixelCache.getPixelZero(x2, y1), (oldX - x1) * (y2 - oldY) / weight, sum);
                sumPixel(pixelCache.getPixelZero(x1, y2), (x2 - oldX) * (oldY - y1) / weight, sum);
                sumPixel(pixelCache.getPixelZero(x2, y2), (oldX - x1) * (oldY - y1) / weight, sum);
                tmp.setPixel(x, y, sum);
            }
        });
        this._width = tmp._width;
        this._height = tmp._height;
        this._data = tmp._data;
    }
    return this;
}
