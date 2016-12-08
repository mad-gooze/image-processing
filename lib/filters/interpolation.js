import Image from '../Image';
import PixelCache from '../PixelCache';
import {clamp, sumPixel, absPixel, cubicHermite} from '../Utils';

export function _interpolation(k, calcFunc) {
    if (k !== 1) {
        const tmp = new Image(Math.round(this.width * k), Math.round(this.height * k), this.imageType);
        const scaleX = (this.width - 1) / (tmp.width - 1);
        const scaleY = (this.height - 1) / (tmp.height - 1);

        tmp.forEachPixel((x, y) => {
            const oldX = x * scaleX;
            const oldY = y * scaleY;
            calcFunc(x, y, oldX, oldY, tmp);
        });

        this._copyDataFrom(tmp);
    }

    return this;
}


export function bilinearInterpolation(k) {
    const pixelCache = new PixelCache(this);
    const sum = new Float64Array(this.channelsNumber);
    return this._interpolation(k, (x, y, oldX, oldY, tmp) => {

        const x0 = Math.floor(oldX);
        const x1 = x0 + 1;

        const y0 = Math.floor(oldY);
        const y1 = y0 + 1;

        sum.fill(0);

        sumPixel(pixelCache.getPixelSafe(x0, y0), (x1 - oldX) * (y1 - oldY), sum);
        sumPixel(pixelCache.getPixelSafe(x1, y0), (oldX - x0) * (y1 - oldY), sum);
        sumPixel(pixelCache.getPixelSafe(x0, y1), (x1 - oldX) * (oldY - y0), sum);
        sumPixel(pixelCache.getPixelSafe(x1, y1), (oldX - x0) * (oldY - y0), sum);

        tmp.setPixel(x, y, sum);
    });
}


export function bicubicInterpolation(k) {
    const pixelCache = new PixelCache(this);

    return this._interpolation(k, (x, y, oldX, oldY, tmp) => {
        const x0 = Math.floor(oldX) - 1;
        const x1 = x0 + 1;
        const x2 = x1 + 1;
        const x3 = x2 + 1;

        const y0 = Math.floor(oldY) - 1;
        const y1 = y0 + 1;
        const y2 = y1 + 1;
        const y3 = y2 + 1;

        const sum = new Float64Array(this.channelsNumber);

        if (x1 === x2 || y1 === y2) {
            tmp.setPixel(x, y, this.getPixel(x1, y1));
        } else {
            sum.fill(0);

            const xFract = oldX - x1;
            const yFract = oldY - y1;

            const p00 = pixelCache.getPixelSafe(x0, y0);
            const p10 = pixelCache.getPixelSafe(x1, y0);
            const p20 = pixelCache.getPixelSafe(x2, y0);
            const p30 = pixelCache.getPixelSafe(x3, y0);

            const p01 = pixelCache.getPixelSafe(x0, y1);
            const p11 = pixelCache.getPixelSafe(x1, y1);
            const p21 = pixelCache.getPixelSafe(x2, y1);
            const p31 = pixelCache.getPixelSafe(x3, y1);

            const p02 = pixelCache.getPixelSafe(x0, y2);
            const p12 = pixelCache.getPixelSafe(x1, y2);
            const p22 = pixelCache.getPixelSafe(x2, y2);
            const p32 = pixelCache.getPixelSafe(x3, y2);

            const p03 = pixelCache.getPixelSafe(x0, y3);
            const p13 = pixelCache.getPixelSafe(x1, y3);
            const p23 = pixelCache.getPixelSafe(x2, y3);
            const p33 = pixelCache.getPixelSafe(x3, y3);

            for (let i = 0; i < this.channelsNumber; i++) {
                const col0 = cubicHermite(p00[i], p10[i], p20[i], p30[i], xFract);
                const col1 = cubicHermite(p01[i], p11[i], p21[i], p31[i], xFract);
                const col2 = cubicHermite(p02[i], p12[i], p22[i], p32[i], xFract);
                const col3 = cubicHermite(p03[i], p13[i], p23[i], p33[i], xFract);
                const value = cubicHermite(col0, col1, col2, col3, yFract);
                sum[i] = clamp(value, 0, 1);
            }
            tmp.setPixel(x, y, sum);
        }
    });
}

export function dcci() {
    // const tmp = new Image(this.width * 2 - 1, this.height * 2 - 1, this.imageType);
    // this.forEachPixel(
    //     (x, y) => tmp.setPixel(x * 2, y * 2, this.getPixel(x, y))
    // );
    //
    // this._width = tmp._width;
    // this._height = tmp._height;
    // this._data = tmp._data;
    // return this;
}
