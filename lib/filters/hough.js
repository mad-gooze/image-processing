import Image from '../Image';
import {GRAY_SCALE} from '../ImageType';

export function hough(sigma = 2, thetaScale = 1, rhoScale = 1) {
    if (sigma) {
        this.canny(sigma);
    }
    const maxDist = Math.hypot(this.width, this.height);
    const houghWidth = Math.floor(180 / thetaScale);
    const houghHeght = Math.floor((maxDist * 2 + 1) / rhoScale);

    const accumulator = new Image(
        houghWidth,
        houghHeght,
        this.imageType
    );

    // cache angles
    const cos = new Float64Array(houghWidth);
    const sin = new Float64Array(houghWidth);
    for (let i = 0; i < cos.length; i++) {
        const theta = (i - 90) / 180 * Math.PI;
        cos[i] = Math.cos(theta);
        sin[i] = Math.sin(theta);
    }

    this.forEachPixel((x, y) => {
        const val = this._data[this._coordsToIndex(x, y)];

        if (val > 0) {
            for (let i = 0; i < accumulator.width; i++) {
                const rho = x * cos[i] + y * sin[i];
                accumulator._data[
                    accumulator._coordsToIndex(i, Math.floor((rho + maxDist) / rhoScale))
                ] += val;
            }
        }
    });

    return this
        ._copyDataFrom(accumulator)
        .normalize();
}

function drawLine(img, rho, theta, power = 1) {
    if (Math.cos(theta) >= 0.5) {
        for (let y = 0; y < img.height; y++) {
            const x = Math.round((rho - y * Math.sin(theta)) / Math.cos(theta));
            if (x < 0 || x >= img.width) {
                continue;
            }
            img._data[img._coordsToIndex(x, y)]++;
        }
    } else {
        for (let x = 0; x < img.width; x++) {
            const y = Math.round((rho - x * Math.cos(theta)) / Math.sin(theta));
            if (y < 0 || y >= img.height) {
                continue;
            }
            img._data[img._coordsToIndex(x, y)]++;
        }
    }
}

export function reverseHough(width, height, thetaScale = 1, rhoScale = 1) {
    const result = new Image(width, height, GRAY_SCALE);
    const maxDist = Math.hypot(width, height);

    let lines = 0;
    this.forEachPixel((i, j) => {
        const val = this._data[this._coordsToIndex(i, j)];

        if (val > 0) {
            const theta = (i - 90) / thetaScale / 180 * Math.PI;
            const rho = (j - maxDist) / rhoScale;
            drawLine(result, rho, theta, val);
            lines++;
        }
    });

    return this
        ._copyDataFrom(result)
        .normalize();
}
