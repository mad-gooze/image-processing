import BMP from 'bmp-js';
import fs from 'mz/fs';
import Color from 'color';

import {GRAY_SCALE, RGB, RGBA, CHANNELS_NUMBER} from './ImageType';
import PixelCache from './PixelCache';
import {clamp, sumPixel, gaussianVector, cubicHermite} from './Utils';

export default class Image {

    constructor(width, height, imgType = RGB,
                imgData = new Float64Array(width * height * CHANNELS_NUMBER[imgType]).fill(0)) {
        this._width = width;
        this._height = height;
        this._imgType = imgType;

        if (imgData) {
            this._data = imgData;
        }
    }

    clone() {
        return new Image(this.width, this.height, this.imageType, new Float64Array(this._data));
    }

    static async fromFile(filename) {
        const bmpData = BMP.decode(await fs.readFile(filename));
        const result = new Image(bmpData.width, bmpData.height, RGB);
        for (let i = 0; i < result.pixelsNumber; i++) {
            for (let j = 0; j < result.channelsNumber; j++) {
                result._data[result.channelsNumber * i + j] = bmpData.data[CHANNELS_NUMBER[RGBA] * i + j] / 255;
            }
        }

        return result;
    }


    static rgbToHSL(rgbImage) {
        if (rgbImage.imageType !== RGB) {
            throw new Error('Image should be RGB');
        }

        const h = new Image(rgbImage.width, rgbImage.height, GRAY_SCALE);
        const s = new Image(rgbImage.width, rgbImage.height, GRAY_SCALE);
        const l = new Image(rgbImage.width, rgbImage.height, GRAY_SCALE);

        for (let i = 0; i < rgbImage.pixelsNumber; i++) {
            const hsl = Color.rgb(rgbImage._getPixel(i).map(val => val * 255)).hsl();

            h._data[i] = hsl.color[0] / 360;
            s._data[i] = hsl.color[1] / 100;
            l._data[i] = hsl.color[2] / 100;
        }
        return [h, s, l];
    }

    static hslToRGB(h, s, l) {

        const result = new Image(h.width, h.height, RGB);

        for (let i = 0; i < result.pixelsNumber; i++) {
            const rgb = Color.hsl(
                h._data[i] * 360, s._data[i] * 100, l._data[i] * 100,
            ).rgb();

            const pixel = Float64Array.from(rgb.color.map(val => val / 255));
            result._setPixel(i, pixel);
        }
        return result;
    }

    async write(filename) {
        const buffer = Buffer.alloc(this.pixelsNumber * CHANNELS_NUMBER[RGBA]);

        switch (this.imageType) {

            case RGB:
                for (let i = 0; i < this.pixelsNumber; i++) {
                    for (let j = 0; j < this.channelsNumber; j++) {
                        buffer[CHANNELS_NUMBER[RGBA] * i + j] = this._data[this.channelsNumber * i + j] * 255;
                    }
                    buffer[CHANNELS_NUMBER[RGBA] * i + this.channelsNumber] = 255;
                }
                break;

            case GRAY_SCALE:
                for (let i = 0; i < this.pixelsNumber; i++) {
                    for (let j = 0; j < CHANNELS_NUMBER[RGB]; j++) {
                        buffer[CHANNELS_NUMBER[RGBA] * i + j] = this._data[i] * 255;
                    }
                    buffer[CHANNELS_NUMBER[RGBA] * i + CHANNELS_NUMBER[RGB]] = 255;
                }
                break;
        }

        return fs.writeFile(
            filename, BMP.encode({
                data: buffer,
                width: this.width,
                height: this.height
            }).data
        );
    }


    get height() {
        return this._height;
    }

    get width() {
        return this._width;
    }

    get pixelsNumber() {
        return this._width * this._height;
    }

    get imageType() {
        return this._imgType;
    }

    get channelsNumber() {
        return CHANNELS_NUMBER[this._imgType];
    }

    _getPixel(index) {
        index *= this.channelsNumber;
        return this._data.subarray(index, index + this.channelsNumber);
    }

    getPixel(x, y) {
        return this._getPixel(this._coordsToIndex(x, y));
    }

    getPixelZero(x, y) {
        return (x <= 0 || x >= this._width || y <= 0 || y >= this._height) ?
            new Float64Array(this.channelsNumber) :
            this._getPixel(this._coordsToIndex(x, y));
    }

    getPixelSafe(x, y) {
        return this.getPixel(
            clamp(x, 0, this._width - 1),
            clamp(y, 0, this._height - 1)
        );
    }

    _setPixel(index, pixel) {
        this._data.set(pixel, index * this.channelsNumber);
    }

    setPixel(x, y, pixel) {
        return this._setPixel(this._coordsToIndex(x, y), pixel);
    }

    _coordsToIndex(x, y) {
        return (y * this._width + x);
    }

    _indexToCoords(i) {
        return [i % this._width, Math.floor(i / this._width)];
    }

    _clampWindow(x, y, radius) {
        return [
            Math.max(0, x - radius), Math.min(this._width - 1, x + radius), // xMin, xMax
            Math.max(0, y - radius), Math.min(this._height - 1, y + radius) // yMin, yMax
        ];
    }

    _checkCoord(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    _copyDataFrom(img) {
        this._data = img._data;
        this._width = img._width;
        this._height = img._height;
        return this;
    }


    forEachPixel(func) {
        for (let y = 0; y < this._height; y++) {
            for (let x = 0; x < this._width; x++) {
                func(x, y, this);
            }
        }
        return this;
    }

    grayscale() {
        if (this.imageType !== GRAY_SCALE) {

            const weights = [0.21, 0.72, 0.07, 0];
            const transform = index => {
                const p = this._getPixel(index);
                return 0.21 * p[0] + 0.72 * p[1] + 0.07 * p[2];
            };

            const newData = new Float64Array(this.pixelsNumber);
            for (let index = 0; index < this.pixelsNumber; index++) {
                newData[index] = transform(index);
            }
            this._data = newData;
            this._imgType = GRAY_SCALE;
        }
        return this;
    }


    invert() {
        let transform = val => 1 - val;
        if (this.imageType === GRAY_SCALE || this.imageType === RGB || this.imageType === RGBA) {
            const colorChannels = Math.min(CHANNELS_NUMBER[RGB], this.channelsNumber);
            for (let index = 0; index < this.pixelsNumber; index++) {
                const pixel = this._getPixel(index);
                for (let i = 0; i < colorChannels; i++) {
                    pixel[i] = transform(pixel[i]);
                }
            }
        }

        return this;
    }

    mirror(vertical = false) {
        const tmp = new Image(this.width, this.height);
        const transform = vertical ?
            (x, y) => [x, this._height - 1 - y] :
            (x, y) => [this._width - 1 - x, y];
        this.forEachPixel((x, y) => {
            const [newX, newY] = transform(x, y);
            tmp.setPixel(newX, newY, this.getPixel(x, y));
        });
        this._data = tmp._data;
        return this;
    }

    gaussian(sigma = 1) {
        const kernel = gaussianVector(sigma);
        return this.convolveSeparable(kernel, kernel);
    }

    gradientMagnitude(sigma = 1) {
        const gauss = gaussianVector(sigma, 0);
        const gaussDx = gaussianVector(sigma, 1);

        this.grayscale();
        const gradX = this.clone().convolveSeparable(gaussDx, gauss); // clone only once
        const gradY = this.convolveSeparable(gauss, gaussDx); // overwrite

        for (let i = 0; i < this._data.length; i++) {
            this._data[i] = Math.hypot(gradX._data[i], gradY._data[i]);
        }
        return this.normalize();
    }


    normalize() {
        if (this.channelsNumber !== 1) {
            throw new Error('Only 1-channel images can be normalized');
        } else {
            let min = 1;
            let max = 0;
            this._data.forEach(pixel => {
                min = Math.min(min, pixel);
                max = Math.max(max, pixel);
            });
            const transform = max === min ?
                () => 0 :
                pixel => (pixel - min) / (max - min);
            this._data.forEach((pixel, i) => this._data[i] = transform(pixel));
            return this;
        }
    }

    callFunc(func) {
        func(this);
        return this;
    }


    _equalizeHistogramGrayscale() {
        const hist = new Float64Array(256);
        const f = new Float64Array(256);

        for (let i = 0; i < this.pixelsNumber; i++) {
            hist[Math.round(this._data[i] * 255)]++;
        }

        f[0] = hist[0] / this.pixelsNumber;
        for (let i = 1; i < 256; i++) {
            f[i] = f[i - 1] + hist[i] / this.pixelsNumber;
        }

        for (let i = 0; i < this.pixelsNumber; i++) {
            this._data[i] = f[Math.round(this._data[i] * 255)];
        }

        return this;
    }

    equalizeHistogram() {
        if (this.imageType === RGB) {
            const [h, s, l] = Image.rgbToHSL(this);
            l._equalizeHistogramGrayscale();
            const equalized = Image.hslToRGB(h, s, l);
            this._data = equalized._data;
            return this;
        } else if (this.imageType === GRAY_SCALE) {
            return this._equalizeHistogramGrayscale();
        } else {
            throw new Error(`Image type ${this.imageType} not supported`);
        }
    }


    _interpolation(k, calcFunc) {
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

    bilinearInterpolation(k) {
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


    bicubicInterpolation(k) {
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
}

import {convolve, convolveSeparable, _convolveSeparableGrayscale} from './filters/convolution';
Image.prototype.convolve = convolve;
Image.prototype.convolveSeparable = convolveSeparable;
Image.prototype._convolveSeparableGrayscale = _convolveSeparableGrayscale;

import medianFilter from './filters/median';
Image.prototype.median = medianFilter;

import {rotate, _rotateHalfPI, _rotatePI, _rotate3HalfPI} from './filters/rotate';
Image.prototype.rotate = rotate;
Image.prototype._rotateHalfPI = _rotateHalfPI;
Image.prototype._rotatePI = _rotatePI;
Image.prototype._rotate3HalfPI = _rotate3HalfPI;

import {canny, edgeMasking, removeEdgyRegions} from './filters/canny';
Image.prototype.canny = canny;
Image.prototype.removeEdgyRegions = removeEdgyRegions;

import {hough, reverseHough, nonMaxismumSupression} from './filters/hough';
Image.prototype.hough = hough;
Image.prototype.reverseHough = reverseHough;
