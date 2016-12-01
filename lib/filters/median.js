import Image from '../Image';
import median from 'median-quickselect';

export default function medianFilter(radius = 1) {
    const emptyPixel = new Float64Array(this.channelsNumber);

    const windows = new Array(this.channelsNumber);
    for (let i = 0; i < this.channelsNumber; i++) {
        windows[i] = new Float64Array((2 * radius + 1) ** 2);
    }
    const tmp = new Image(this.width, this.height, this.imageType);

    this.forEachPixel((x, y) => {

        const xMin = Math.max(0, x - radius);
        const xMax = Math.min(this.width - 1, x + radius);
        const yMin = Math.max(0, y - radius);
        const yMax = Math.min(this.height - 1, y + radius);

        const windowLength = (xMax - xMin) * (yMax - yMin);
        let windowIndex = 0;

        for (let _y = yMin; _y <= yMax; _y++) {
            for (let _x = xMin; _x <= xMax; _x++) {
                const index = this._coordsToIndex(_x, _y);
                for (let i = 0; i < this.channelsNumber; i++)
                    windows[i][windowIndex] = this._data[this.channelsNumber * index + i];
                windowIndex++;
            }
        }

        for (let i = 0; i < this.channelsNumber; i++) {
            emptyPixel[i] = median(windows[i].subarray(0, windowLength));
        }
        tmp.setPixel(x, y, emptyPixel);
    });
    this._data = tmp._data;
    return this;
}