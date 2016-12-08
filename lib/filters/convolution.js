import Image from '../Image';
import {sumPixel} from '../Utils';
import PixelCache from '../PixelCache';

export function convolve(kernel) {
    const sum = new Float64Array(this.channelsNumber);
    const tmp = new Image(this.width, this.height, this.imageType);
    const pixelCache = new PixelCache(this);

    this.forEachPixel((x, y) => {
        sum.fill(0);
        for (let j = 0; j < kernel.length; j++) {
            const _y = y - j + Math.floor(kernel.length / 2);
            for (let i = 0; i < kernel[0].length; i++) {
                const _x = x - i + Math.floor(kernel[0].length / 2);
                sumPixel(
                    pixelCache.getPixelSafe(_x, _y),
                    kernel[kernel.length - 1 - j][kernel[0].length - 1 -i],
                    sum
                );
            }
        }
        tmp.setPixel(x, y, sum);
    });
    this._data = tmp._data;
    return this;
}


export function convolveSeparable(kernelX, kernelY) {
    if (!kernelY) {
        kernelY = kernelX[1];
        kernelX = kernelX[0];
    }
    const sum = new Float64Array(this.channelsNumber);
    const tmp = new Image(this.width, this.height, this.imageType);

    const radiusX = Math.floor(kernelX.length / 2);
    const radiusY = Math.floor(kernelY.length / 2);

    let pixelCache = new PixelCache(this);
    this.forEachPixel((x, y) => {
        sum.fill(0);
        for (let i = 0; i < kernelX.length; i++) {
            const _x = x - i + radiusX;
            sumPixel(
                pixelCache.getPixelSafe(_x, y),
                kernelX[kernelX.length - 1 - i],
                sum
            );
        }
        tmp.setPixel(x, y, sum);
    });

    pixelCache = new PixelCache(tmp);
    this.forEachPixel((x, y) => {
        sum.fill(0);
        for (let j = 0; j < kernelY.length; j++) {
            const _y = y - j + radiusY;
            sumPixel(
                pixelCache.getPixelSafe(x, _y),
                kernelY[kernelY.length - 1 - j],
                sum
            );
        }
        this.setPixel(x, y, sum);
    });
    return this;
}
