import Image from '../Image';
import PixelCache from '../PixelCache';
import { clamp, sumPixel, absPixel, cubicHermite } from '../Utils';

export function _interpolation(k, calcFunc) {
    const tmp = new Image(Math.round(this.width * k), Math.round(this.height * k), this.imageType);
    const scaleX = (this.width - 1) / (tmp.width - 1);
    const scaleY = (this.height - 1) / (tmp.height - 1);

    tmp.forEachPixel((x, y) => {
        const oldX = x * scaleX;
        const oldY = y * scaleY;
        calcFunc(x, y, oldX, oldY, tmp);
    });

    this._width = tmp._width;
    this._height = tmp._height;
    this._data = tmp._data;
    return this;
}


export function bilinearInterpolation(k) {
    const pixelCache = new PixelCache(this);
    const sum = new Float64Array(this.channelsNumber);
    const windowX = new Int32Array(2);
    const windowY = new Int32Array(2);

    return this._interpolation(k, (x, y, oldX, oldY, tmp) => {

        windowX[0] = Math.floor(oldX);
        windowX[1] = windowX[0] + 1;

        windowY[0] = Math.floor(oldY);
        windowY[1] = windowY[0] + 1;

        sum.fill(0);

        sumPixel(pixelCache.getPixelSafe(windowX[0], windowY[0]), (windowX[1] - oldX) * (windowY[1] - oldY), sum);
        sumPixel(pixelCache.getPixelSafe(windowX[1], windowY[0]), (oldX - windowX[0]) * (windowY[1] - oldY), sum);
        sumPixel(pixelCache.getPixelSafe(windowX[0], windowY[1]), (windowX[1] - oldX) * (oldY - windowY[0]), sum);
        sumPixel(pixelCache.getPixelSafe(windowX[1], windowY[1]), (oldX - windowX[0]) * (oldY - windowY[0]), sum);

        tmp.setPixel(x, y, sum);
    });
}


export function bicubicInterpolation(k) {
    const pixelCache = new PixelCache(this);

    const windowX = new Int32Array(4);
    const windowY = new Int32Array(4);
    const sum = new Float64Array(this.channelsNumber);

    const p = new Array(4);
    for (let i = 0; i < 4; i++)
        p[i] = new Array(4);

    return this._interpolation(k, (x, y, oldX, oldY, tmp) => {

        windowX[0] = Math.floor(oldX) - 1;
        windowY[0] = Math.floor(oldY) - 1;

        for (let i = 1; i < windowX.length; i++) {
            windowX[i] = windowX[i - 1] + 1;
            windowY[i] = windowY[i - 1] + 1;
        }

        if (windowX[1] === windowX[2] || windowY[1] === windowY[2]) {
            tmp.setPixel(x, y, this.getPixel(windowX[1], windowY[1]));
        } else {
            sum.fill(0);

            const xFract = oldX - windowX[1];
            const yFract = oldY - windowY[1];

            const p00 = pixelCache.getPixelSafe(windowX[0], windowY[0]);
            const p10 = pixelCache.getPixelSafe(windowX[1], windowY[0]);
            const p20 = pixelCache.getPixelSafe(windowX[2], windowY[0]);
            const p30 = pixelCache.getPixelSafe(windowX[3], windowY[0]);

            const p01 = pixelCache.getPixelSafe(windowX[0], windowY[1]);
            const p11 = pixelCache.getPixelSafe(windowX[1], windowY[1]);
            const p21 = pixelCache.getPixelSafe(windowX[2], windowY[1]);
            const p31 = pixelCache.getPixelSafe(windowX[3], windowY[1]);

            const p02 = pixelCache.getPixelSafe(windowX[0], windowY[2]);
            const p12 = pixelCache.getPixelSafe(windowX[1], windowY[2]);
            const p22 = pixelCache.getPixelSafe(windowX[2], windowY[2]);
            const p32 = pixelCache.getPixelSafe(windowX[3], windowY[2]);

            const p03 = pixelCache.getPixelSafe(windowX[0], windowY[3]);
            const p13 = pixelCache.getPixelSafe(windowX[1], windowY[3]);
            const p23 = pixelCache.getPixelSafe(windowX[2], windowY[3]);
            const p33 = pixelCache.getPixelSafe(windowX[3], windowY[3]);

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
    const tmp = new Image(this.width * 2 - 1, this.height * 2 - 1, this.imageType);
    this.forEachPixel(
        (x, y) => tmp.setPixel(x * 2, y * 2, this.getPixel(x, y))
    );

    this._width = tmp._width;
    this._height = tmp._height;
    this._data = tmp._data;
    return this;
}


function detectDirect(img, x, y, type, k, T) {
    const d1 = new Float64Array(img.channelsNumber).fill(0);
    const d2 = new Float64Array(img.channelsNumber).fill(0);

    const t = new Array(5);

    if (type === 1) {
        // 45 degree diagonal direction
        t1 = Math.abs(img.getPixel(3, 1) - img.getPixel(1, 3));
        t2 = Math.abs(img.getPixel(5, 1) - img.getPixel(3, 3)) + Math.abs(img.getPixel(3, 3) - img.getPixel(1, 5));
        t3 = Math.abs(img.getPixel(7, 1) - img.getPixel(5, 3)) + Math.abs(img.getPixel(5, 3) - img.getPixel(3, 5)) + Math.abs(img.getPixel(3, 5) - img.getPixel(1, 7));
        t4 = Math.abs(img.getPixel(7, 3) - img.getPixel(5, 5)) + Math.abs(img.getPixel(5, 5) - img.getPixel(3, 7));
        t5 = Math.abs(img.getPixel(7, 5) - img.getPixel(5, 7));

        sumPixel(t1, 1, d1);
        sumPixel(t2, 1, d1);
        sumPixel(t3, 1, d1);
        sumPixel(t4, 1, d1);
        sumPixel(t5, 1, d1);

        // 135 degree diagonal direction
        t1 = Math.abs(img.getPixel(1, 5) - img.getPixel(3, 7));
        t2 = Math.abs(img.getPixel(1, 3) - img.getPixel(3, 5)) + Math.abs(img.getPixel(3, 5) - img.getPixel(5, 7));
        t3 = Math.abs(img.getPixel(1, 1) - img.getPixel(3, 3)) + Math.abs(img.getPixel(3, 3) - img.getPixel(5, 5)) + Math.abs(img.getPixel(5, 5) - img.getPixel(7, 7));
        t4 = Math.abs(img.getPixel(3, 1) - img.getPixel(5, 3)) + Math.abs(img.getPixel(5, 3) - img.getPixel(7, 5));
        t5 = Math.abs(img.getPixel(5, 1) - img.getPixel(7, 3));

        sumPixel(t1, 1, d2);
        sumPixel(t2, 1, d2);
        sumPixel(t3, 1, d2);
        sumPixel(t4, 1, d2);
        sumPixel(t5, 1, d2);

    } else {
        // horizontal direction
        t1 = Math.abs(img.getPixel(1, 2) - img.getPixel(1, 4)) + Math.abs(img.getPixel(3, 2) - img.getPixel(3, 4)) + Math.abs(img.getPixel(5, 2) - img.getPixel(5, 4));
        t2 = Math.abs(img.getPixel(2, 1) - img.getPixel(2, 3)) + Math.abs(img.getPixel(2, 3) - img.getPixel(2, 5));
        t3 = Math.abs(img.getPixel(4, 1) - img.getPixel(4, 3)) + Math.abs(img.getPixel(4, 3) - img.getPixel(4, 5));
        sumPixel(t1, 1, d1);
        sumPixel(t2, 1, d1);
        sumPixel(t3, 1, d1);

        // vertical direction
        t1 = Math.abs(img.getPixel(2, 1) - img.getPixel(4, 1)) + Math.abs(img.getPixel(2, 3) - img.getPixel(4, 3)) + Math.abs(img.getPixel(2, 5) - img.getPixel(4, 5));
        t2 = Math.abs(img.getPixel(1, 2) - img.getPixel(3, 2)) + Math.abs(img.getPixel(3, 2) - img.getPixel(5, 2));
        t3 = Math.abs(img.getPixel(1, 4) - img.getPixel(3, 4)) + Math.abs(img.getPixel(3, 4) - img.getPixel(5, 4));
        sumPixel(t1, 1, d2);
        sumPixel(t2, 1, d2);
        sumPixel(t3, 1, d2);
    }


    // Compute the weight vector
    w1 = 1 + d1 ^ k;
    w2 = 1 + d2 ^ k;
    w = [1 / w1 1 / w2];

    // Compute the directional index
    n = 3;
    if ((1 + d1) / (1 + d2) > T) {
        n = 1;
    } else if ((1 + d2) / (1 + d1) > T) {
        n = 2;
    }
    return [w, n];
}


// function pixelValue(A, type, w, n) {
//     f = [-1 9 9 - 1] / 16;
//     if (type == 1) {
//         v1 = [img.getPixel(7, 1) img.getPixel(5, 3) img.getPixel(3, 5) img.getPixel(1, 7)];
//         v2 = [img.getPixel(1, 1) img.getPixel(3, 3) img.getPixel(5, 5) img.getPixel(7, 7)];
//     } else {
//         v1 = [img.getPixel(4, 1) img.getPixel(4, 3) img.getPixel(4, 5) img.getPixel(4, 7)];
//         v2 = [img.getPixel(1, 4) img.getPixel(3, 4) img.getPixel(5, 4) img.getPixel(7, 4)];
//     }
//
//     if (n == 1) {
//         p = sum(v2. * f);
//     } else if (n == 2) {
//         p = sum(v1. * f);
//     } else {
//         p1 = sum(v1. * f);
//         p2 = sum(v2. * f);
//         p = (w(1) * p1 + w(2) * p2) / (w(1) + w(2));
//     }
//     return p;
// }


