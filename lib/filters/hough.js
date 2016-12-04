import Image from '../Image';

const D_TETHA = 5;
const D_RHO = 5;

export function hough() {
    this.canny(2);
    const maxDist = Math.hypot(this.width, this.height);
    const accumulator = new Image(
        180 / D_TETHA,
        Math.ceil(maxDist * 2 / D_RHO + 1),
        this.imageType
    );

    this.forEachPixel((x, y) => {
        const val = this._data[this._coordsToIndex(x, y)];

        if (val > 0) {
            for (let j = 0; j < accumulator.width; j++) {
                const tetha = (j * D_TETHA - 90) / 180 * Math.PI;
                const p = x * Math.cos(tetha) + y * Math.sin(tetha);
                accumulator._data[accumulator._coordsToIndex(j, Math.round((p + maxDist) / D_RHO))]++;
            }
        }
    });

    this._width = accumulator._width;
    this._height = accumulator._height;
    this._data = accumulator._data;

    return this.normalize();
}
