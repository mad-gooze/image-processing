import Image from '../Image';
import PixelCache from '../PixelCache';
import {clamp, sumPixel, cubicHermite, mirror} from '../Utils';
import {GRAY_SCALE, RGB} from '../ImageType';

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

        tmp.setPixel(x, y, sum.map(c => clamp(c, 0, 1)));
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


export function _dcciGrayscale(k, T) {
    const tmp = new Image(this.width * 2 - 1, this.height * 2 - 1, this.imageType);
    this.forEachPixel(
        (x, y) => tmp.setPixel(x * 2, y * 2, this.getPixel(x, y))
    );

    for (let j = 1; j < tmp.height; j += 2) {
        for (let i = 1; i < tmp.width; i += 2) {
            const [w, n] = detectDirect(tmp, i, j, 1, k, T);
            tmp._data[tmp._coordsToIndex(i, j)] = pixelValue(tmp, i, j, 1, w, n);
        }
    }

    for (let j = 1; j < tmp.height; j += 2) {
        for (let i = 0; i < tmp.width; i += 2) {
            const [w, n] = detectDirect(tmp, i, j, 2, k, T);
            tmp._data[tmp._coordsToIndex(i, j)] = pixelValue(tmp, i, j, 2, w, n);
        }
    }

    for (let j = 0; j < tmp.height; j += 2) {
        for (let i = 1; i < tmp.width; i += 2) {
            const [w, n] = detectDirect(tmp, i, j, 2, k, T);
            tmp._data[tmp._coordsToIndex(i, j)] = pixelValue(tmp, i, j, 2, w, n);
        }
    }

    return this._copyDataFrom(tmp);
}


const aFunc = (img, i, j) => (x, y) => {
    const cx = mirror(i - 3 + x - 1, 0, img.width - 1);
    const cy = mirror(j - 3 + y - 1, 0, img.height - 1);
    return img._data[img._coordsToIndex(cx, cy)];
};

function detectDirect(img, i, j, type, k, T) {
    const _A = aFunc(img, i, j);

    let t1;
    let t2;
    let t3;
    let t4;
    let t5;
    let d1;
    let d2;

    if (type === 1) {
        // 45 degree diagonal direction
        t1 = Math.abs(_A(3, 1) - _A(1, 3));
        t2 = Math.abs(_A(5, 1) - _A(3, 3)) + Math.abs(_A(3, 3) - _A(1, 5));
        t3 = Math.abs(_A(7, 1) - _A(5, 3)) + Math.abs(_A(5, 3) - _A(3, 5)) + Math.abs(_A(3, 5) - _A(1, 7));
        t4 = Math.abs(_A(7, 3) - _A(5, 5)) + Math.abs(_A(5, 5) - _A(3, 7));
        t5 = Math.abs(_A(7, 5) - _A(5, 7));
        d1 = t1 + t2 + t3 + t4 + t5;

        // 135 degree diagonal direction
        t1 = Math.abs(_A(1, 5) - _A(3, 7));
        t2 = Math.abs(_A(1, 3) - _A(3, 5)) + Math.abs(_A(3, 5) - _A(5, 7));
        t3 = Math.abs(_A(1, 1) - _A(3, 3)) + Math.abs(_A(3, 3) - _A(5, 5)) + Math.abs(_A(5, 5) - _A(7, 7));
        t4 = Math.abs(_A(3, 1) - _A(5, 3)) + Math.abs(_A(5, 3) - _A(7, 5));
        t5 = Math.abs(_A(5, 1) - _A(7, 3));
        d2 = t1 + t2 + t3 + t4 + t5;
    } else {
        // horizontal direction
        t1 = Math.abs(_A(1, 2) - _A(1, 4)) + Math.abs(_A(3, 2) - _A(3, 4)) + Math.abs(_A(5, 2) - _A(5, 4));
        t2 = Math.abs(_A(2, 1) - _A(2, 3)) + Math.abs(_A(2, 3) - _A(2, 5));
        t3 = Math.abs(_A(4, 1) - _A(4, 3)) + Math.abs(_A(4, 3) - _A(4, 5));
        d1 = t1 + t2 + t3;

        // vertical direction
        t1 = Math.abs(_A(2, 1) - _A(4, 1)) + Math.abs(_A(2, 3) - _A(4, 3)) + Math.abs(_A(2, 5) - _A(4, 5));
        t2 = Math.abs(_A(1, 2) - _A(3, 2)) + Math.abs(_A(3, 2) - _A(5, 2));
        t3 = Math.abs(_A(1, 4) - _A(3, 4)) + Math.abs(_A(3, 4) - _A(5, 4));
        d2 = t1 + t2 + t3;
    }

    // Compute the weight vector
    const w1 = 1 + d1 ** k;
    const w2 = 1 + d2 ** k;
    const w = [1 / w1, 1 / w2];

    // Compute the directional index
    let n = 3;
    if ((1 + d1) / (1 + d2) > T) {
        n = 1;
    } else {
        n = 2;
    }
    return [w, n];
}

function pixelValue(img, i, j, type, w, n) {
    const _A = aFunc(img, i, j);

    const f = [-1, 9, 9, -1].map(c => c / 16);
    let v1;
    let v2;

    if (type === 1) {
        v1 = [_A(7, 1), _A(5, 3), _A(3, 5), _A(1, 7)];
        v2 = [_A(1, 1), _A(3, 3), _A(5, 5), _A(7, 7)];
    } else {
        v1 = [_A(4, 1), _A(4, 3), _A(4, 5), _A(4, 7)];
        v2 = [_A(1, 4), _A(3, 4), _A(5, 4), _A(7, 4)];
    }

    let p1;
    let p2;
    let p;

    if (n === 1) {
        p = v2
            .map((val, _i) => val * f[_i])
            .reduce((a, b) => a + b);
    } else if (n === 2) {
        p = v1
            .map((val, _i) => val * f[_i])
            .reduce((a, b) => a + b);
    } else {
        p1 = v1
            .map((val, _i) => val * f[_i])
            .reduce((a, b) => a + b);
        p2 = v2
            .map((val, _i) => val * f[_i])
            .reduce((a, b) => a + b);
        p = (w[0] * p1 + w[1] * p2) / (w[0] + w[1]);
    }
    return clamp(p, 0, 1);
}

export function dcci(k = 5, T = 1.25) {
    if (this.imageType === GRAY_SCALE) {
        return this._dcciGrayscale(k, T);
    } else if (this.imageType === RGB) {
        const [r, g, b] = Image.splitRGB(this);

        r.dcci();
        g.dcci();
        b.dcci();

        const result = Image.combineRGB(r, g, b);
        return this._copyDataFrom(result);
    } else {
        throw new Error('Not implemented');
    }
}
