import Image from '../Image';
import {gaussianVector} from '../Utils';

const directions = Int32Array.of(0, 45, 90, 135, 0, 45, 90, 135, 0);
function nonMaximumSupression(magnitudeMap, directionMap) {
    const result = new Image(magnitudeMap.width, magnitudeMap.height, magnitudeMap.imageType);
    const compareTo = new Float64Array(2);

    return result.forEachPixel((x, y) => {
        const index = magnitudeMap._coordsToIndex(x, y);

        const magnitude = magnitudeMap._data[index];
        const direction = directionMap._data[index];

        const angle = directions[Math.round(direction / Math.PI * 4) + 4];

        if (angle === 0) {
            compareTo[0] = magnitudeMap._data[magnitudeMap._coordsToIndex(x - 1, y)];
            compareTo[1] = magnitudeMap._data[magnitudeMap._coordsToIndex(x + 1, y)];
        } else if (angle === 45) {
            compareTo[0] = magnitudeMap._data[magnitudeMap._coordsToIndex(x + 1, y + 1)];
            compareTo[1] = magnitudeMap._data[magnitudeMap._coordsToIndex(x - 1, y - 1)];
        } else if (angle === 90) {
            compareTo[0] = magnitudeMap._data[magnitudeMap._coordsToIndex(x, y - 1)];
            compareTo[1] = magnitudeMap._data[magnitudeMap._coordsToIndex(x, y + 1)];
        } else if (angle === 135) {
            compareTo[0] = magnitudeMap._data[magnitudeMap._coordsToIndex(x + 1, y - 1)];
            compareTo[1] = magnitudeMap._data[magnitudeMap._coordsToIndex(x - 1, y + 1)];
        }

        if (magnitude >= compareTo[0] && magnitude >= compareTo[1]) {
            result._data[index] = magnitude;
        }
    });
}


function doubleThreshold(magnitude, t1, t2) {
    const low = new Image(magnitude.width, magnitude.height, magnitude.imageType);
    const high = new Image(magnitude.width, magnitude.height, magnitude.imageType);

    for (let i = 0; i < magnitude._data.length; i++) {
        const val = magnitude._data[i];
        if (val >= t1 && val < t2) {
            low._data[i] = val;
        } else if (val >= t2) {
            high._data[i] = val;
        }
    }

    return [low, high];
}


const dx = Int8Array.of(-1, 0, 1, -1, 1, -1, 0, 1);
const dy = Int8Array.of(-1, -1, -1, 0, 0, 1, 1, 1);

function traverse(low, high, visited, x, y) {

    if (x < 0 || y < 0 || x >= low.width || y >= low.height || visited._data[visited._coordsToIndex(x, y)]) {
        return;
    }
    if (x < 0 || y < 0 || x >= low.width || y >= low.height || visited._data[visited._coordsToIndex(x, y)]) {
        return;
    }

    for (let i = 0; i < dx.length; i++) {
        const _x = x + dx[i];
        const _y = y + dy[i];
        const index = visited._coordsToIndex(_x, _y);

        if (!high._data[index] && low._data[index]) {
            high._data[index] = low._data[index];
            traverse(low, high, visited, _x, _y);
            visited._data[index] = 1;
        }

    }
}

function analyseBlobs(low, high) {
    const visited = new Image(low.width, low.height, low.imageType);

    low.forEachPixel((x, y) => {
        const index = high._coordsToIndex(x, y);
        if (high._data[index] > 0) {
            traverse(low, high, visited, x, y);
            visited._data[index] = 1;
        }
    });
}

export function canny(sigma = 1, t1 = 0.1, t2 = 0.2) {
    const gauss = gaussianVector(sigma, 0);
    const gaussDx = gaussianVector(sigma, 1);

    this.grayscale();
    const gradX = this.clone().convolveSeparable(gaussDx, gauss);
    const gradY = this.clone().convolveSeparable(gauss, gaussDx);

    const magnitude = new Image(this.width, this.height, this.imageType);
    const direction = new Image(this.width, this.height, this.imageType);

    for (let i = 0; i < this._data.length; i++) {
        magnitude._data[i] = Math.hypot(gradY._data[i], gradX._data[i]);
        direction._data[i] = Math.atan2(gradY._data[i], gradX._data[i]);
    }

    const [low, high] = doubleThreshold(
        nonMaximumSupression(magnitude, direction).normalize(), t1, t2
    );
    analyseBlobs(low, high);

    this._data = high._data;

    return this;
}

function removeEdgyRegionsWindow(img, result, x, y, radius, fullness) {
    let edgyPixels = 0;
    let pixels = 0;

    for (let j = y - radius; j <= y + radius; j++) {
        for (let i = x - radius; i <= x + radius; i++) {
            if (result._checkCoord(i, j)) {

                const val = img._data[img._coordsToIndex(i, j)];
                if (val > 0) {
                    edgyPixels++;
                }
                pixels++;
            }
        }
    }
    const index = result._coordsToIndex(x, y);
    if (edgyPixels / pixels <= fullness) {
        result._data[index] = img._data[index];
    } else {
        result._data[index] = 0;
    }


}

export function removeEdgyRegions(radius = 3, fullness = 1 / (2 * radius + 1) + 0.001) {
    const result = new Image(this.width, this.height, this.imageType);
    result.forEachPixel((x, y) => removeEdgyRegionsWindow(this, result, x, y, radius, fullness));
    this._data = result._data;
    return this;
}
