import numeric from 'numeric';
import Image from './lib/Image';
import {sumPixel} from './lib/Utils';
import PixelCache from './lib/PixelCache';
import {GRAY_SCALE} from './lib/ImageType';
import {mseLocalGrayscale} from './lib/Metrics';

const findMax = img => {
    let maxIndex = 0;
    let maxVal = img._data[maxIndex];
    for (let i = 1; i < img._data.length; i++) {
        if (img._data[i] > maxVal) {
            maxIndex = i;
            maxVal = img._data[i];
        }
    }
    return maxIndex;
};

const findMin = img => {
    let minIndex = 0;
    let minVal = img._data[minIndex];
    for (let i = 1; i < img._data.length; i++) {
        if (img._data[i] < minVal) {
            minIndex = i;
            minVal = img._data[i];
        }
    }
    return minIndex;
};

const intersect = (l1, l2) => {
    const a1 = Math.cos(l1.theta);
    const b1 = Math.sin(l1.theta);
    const c1 = l1.rho;

    const a2 = Math.cos(l2.theta);
    const b2 = Math.sin(l2.theta);
    const c2 = l2.rho;

    const det = a2 * b1 - a1 * b2;
    let x;
    let y;

    if (Math.abs(det) < 1e-4) {
        x = y = Infinity;
    } else {
        x = (b1 * c2 - b2 * c1) / det;
        y = (a2 * c1 - a1 * c2) / det;
    }

    return {
        x, y
    };
};

const swap = (arr, i, j) => {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
};

const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

function getTransform(from, to) {
    let A = []; // 8x8
    for (let i = 0; i < 4; i++) {
        A.push([from[i].x, from[i].y, 1, 0, 0, 0, -from[i].x * to[i].x, -from[i].y * to[i].x]);
        A.push([0, 0, 0, from[i].x, from[i].y, 1, -from[i].x * to[i].y, -from[i].y * to[i].y]);
    }

    let b = []; // 8x1
    for (let i = 0; i < 4; i++) {
        b.push(to[i].x);
        b.push(to[i].y);
    }

    // Solve A * h = b for h
    let h = numeric.solve(A, b);

    let H = [
        [h[0], h[1], h[2]],
        [h[3], h[4], h[5]],
        [h[6], h[7], 1]
    ];

    return H;
}

function transform(p, H) {
    const transformed = numeric.dot(H, [p.x, p.y, 1]);
    return {x: transformed[0] / transformed[2], y: transformed[1] / transformed[2]};
}


function cut(input, rect, width, height) {
    const result = new Image(width, height, input.imageType);
    const transformFrom = [
        {x: 0, y: 0},
        {x: width - 1, y: 0},
        {x: width - 1, y: height - 1},
        {x: 0, y: height - 1},
    ];
    const H = getTransform(transformFrom, rect);
    const pixelCache = new PixelCache(input);
    const sum = new Float64Array(input.channelsNumber);

    result.forEachPixel((x, y) => {
        const oldP = transform({x, y}, H);

        const oldX = oldP.x;
        const oldY = oldP.y;

        sum.fill(0);
        const x0 = Math.floor(oldP.x);
        const x1 = x0 + 1;
        const y0 = Math.floor(oldP.y);
        const y1 = y0 + 1;

        sumPixel(pixelCache.getPixel(x0, y0), (x1 - oldX) * (y1 - oldY), sum);
        sumPixel(pixelCache.getPixel(x1, y0), (oldX - x0) * (y1 - oldY), sum);
        sumPixel(pixelCache.getPixel(x0, y1), (x1 - oldX) * (oldY - y0), sum);
        sumPixel(pixelCache.getPixel(x1, y1), (oldX - x0) * (oldY - y0), sum);

        result.setPixel(x, y, sum);
    });
    return result;
}

function maskHoughWindow(img, result, val, index, x, y, radius, maskFactor) {
    for (let j = y - radius; j <= y + radius; j++) {
        for (let i = x - radius; i <= x + radius; i++) {

            let cx = (i + result.width) % result.width;
            let cy = (j + result.height) % result.height;

            // cycle
            if (
                ((i < 0 || i > result.width - 1) && (j >= 0 && j <= result.height - 1)) ||
                ((j < 0 || j > result.height - 1) && (i >= 0 && i <= result.width - 1))
            ) {
                cy = result.height - 1 - cy;
            }

            const val2 = img._data[img._coordsToIndex(cx, cy)];
            if (val2 > val * maskFactor) {
                result._data[index] = 0;
                return;
            }
        }
    }

    result._data[index] = val;
}

function maskHough(img, radius = 3, maskFactor = 1) {
    const result = new Image(img.width, img.height, img.imageType);
    result.forEachPixel((x, y) => {
        const index = img._coordsToIndex(x, y);
        const val = img._data[index];
        if (val > 0) {
            maskHoughWindow(img, result, val, index, x, y, radius, maskFactor);
        }
    });
    return result;
}


function extractPhotoRect(input, index) {
    const downscaleCoeff = 1 / 2;
    const edgyRadius = 5;
    const edgeMaskingRadius = 30;
    const sigma = 1;

    const thetaScale = 1;
    const rhoScale = 1;

    const canny = input
        .clone()
        .bilinearInterpolation(downscaleCoeff)
        .canny(sigma)
        .removeEdgyRegions(edgyRadius);

    console.log(`Image #${index}: computed Canny`);

    canny.write(`temp/canny-${index}.bmp`);
    let hough = canny.clone().hough(false, thetaScale, rhoScale);
    hough.write(`temp/hough-${index}.bmp`);

    hough = maskHough(hough, edgeMaskingRadius);

    const maxIndexes = new Array(4);
    for (let i = 0; i < maxIndexes.length; i++) {
        maxIndexes[i] = findMax(hough);
        hough._data[maxIndexes[i]] = 0;
    }

    const lines = new Array(4);
    const maxDist = Math.hypot(canny.width, canny.height);

    // extract lines
    for (let k = 0; k < 4; k++) {
        const [i, j] = hough._indexToCoords(maxIndexes[k]);
        lines[k] = {
            theta: (i - 90) / thetaScale / 180 * Math.PI,
            rho: (j - maxDist) / rhoScale
        };
    }

    // prepare hough for reverse
    hough._data.fill(0);
    for (let i = 0; i < maxIndexes.length; i++) {
        hough._data[maxIndexes[i]] = 1;
    }
    hough.reverseHough(canny.width, canny.height).write(`temp/reverse-${index}.bmp`);

    lines.sort((l1, l2) => l1.theta - l2.theta); // sort extracted lines by angle

    // compute all intersections
    const points = [];
    for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
            points.push(intersect(lines[i], lines[j]));
        }
    }
    // filter intersections outside of image
    let rect = points.filter(p => canny._checkCoord(p.x, p.y));
    if (rect.length !== 4) {
        throw new Error(`Could not find quadrangle (found ${rect.length} points)`);
    }

    // place points in order
    //
    //     rect[0]----------------rect[1]
    //       |                      |
    //       |                      |
    //     rect[3]----------------rect[2]

    rect.sort((p1, p2) => Math.hypot(p1.x, p1.y) - Math.hypot(p2.x, p2.y));
    if (rect[1].y > rect[2].y) {
        swap(rect, 1, 2);
    }
    swap(rect, 3, 2);

    const scaleX = (input.width - 1) / (canny.width - 1);
    const scaleY = (input.height - 1) / (canny.height - 1);
    rect = rect.map(p => {
        p.x *= scaleX;
        p.y *= scaleY;
        return p;
    });

    const width = Math.round(
        (dist(rect[0], rect[1]) + dist(rect[2], rect[3])) / 2
    );
    const height = Math.round(
        (dist(rect[0], rect[3]) + dist(rect[1], rect[2])) / 2
    );

    return [rect, width, height];
}

function multipleHistogramCDF(images, resolution) {
    const hist = new Array(images[0].channelsNumber);
    const cdf = new Array(images[0].channelsNumber);

    for (let i = 0; i < hist.length; i++) {
        hist[i] = new Float64Array(resolution).fill(0);
        cdf[i] = new Float64Array(resolution);
    }


    for (let img of images) {
        for (let index = 0; index < img.pixelsNumber; index++) {
            const pixel = img._getPixel(index);
            for (let i = 0; i < hist.length; i++) {
                hist[i][Math.round(pixel[i] * (resolution - 1))]++;
            }
        }
    }

    // normalize histogram
    for (let i = 0; i < hist.length; i++) {
        for (let j = 0; j < resolution; j++) {
            hist[i][j] = hist[i][j] * (resolution - 1) / images.length / images[0].pixelsNumber;
        }
    }

    // console.log(JSON.stringify(hist[2], null, 2));
    // console.log(hist[2].reduce((x, y) => x + y));
    for (let k = 0; k < hist.length; k++) {
        cdf[k][0] = 0;
        for (let i = 1; i < resolution; i++) {
            cdf[k][i] = cdf[k][i - 1] + hist[k][i];
        }
    }

    for (let k = 0; k < hist.length; k++) {
        for (let i = 0; i < resolution; i++) {
            cdf[k][i] = Math.round(cdf[k][i]);
        }
    }

    return cdf;
}


function invertCDF(cdf, resolution) {
    const result = new Array(cdf.length);
    for (let k = 0; k < cdf.length; k++) {
        result[k] = new Float64Array(resolution).fill(0);

        result[k][0] = 0;
        for (let i = 1; i < cdf[k].length; i++) {
            result[k][cdf[k][i]] = i;
        }
        for (let i = 1; i < cdf[k].length; i++) {
            if (result[k][i] === 0) {
                result[k][i] = result[k][i - 1];
            }
        }
    }
    return result;
}


function matchHistograms(images, resolution = 300) {
    const inverseCDF = invertCDF(multipleHistogramCDF(images, resolution), resolution);
    const imageCDFs = images.map(img => multipleHistogramCDF([img], resolution));
    // console.log(JSON.stringify(inverseCDF, null, 2));
    for (let k = 0; k < images.length; k++) {
        const img = images[k];
        const cdf = imageCDFs[k];

        for (let index = 0; index < img.pixelsNumber; index++) {
            const pixel = img._getPixel(index);
            for (let i = 0; i < img.channelsNumber; i++) {
                pixel[i] = inverseCDF[i][
                    cdf[i][Math.round(pixel[i] * (resolution - 1))]
                ] / (resolution - 1);
            }
        }
    }
}

export function dehighlight(inputImages) {
    const rects = [];

    const widths = [];
    const heights = [];
    const clipped = [];
    const indexes = [];

    for (let i = 0; i < inputImages.length; i++) {
        try {
            const [rect, width, height] = extractPhotoRect(inputImages[i], i);

            if (width * height < inputImages[i].pixelsNumber / 2) {
                throw new Error('found rect is too small');
            }

            console.log(`Image #${i}: found rect`);
            rects.push(rect);
            widths.push(width);
            heights.push(height);
            indexes.push(i);
        } catch (e) {
            console.error(`Image #${i}: ${e.message}`);
        }
    }
    if (!rects.length) {
        throw new Error('Nothing to merge, no images extracted');
    } else {

        const width = Math.round(widths.reduce((a, b) => a + b) / rects.length);
        const height = Math.round(heights.reduce((a, b) => a + b) / rects.length);

        for (let i = 0; i < rects.length; i++) {
            clipped.push(cut(inputImages[indexes[i]], rects[i], width, height));
            console.log(`Image #${indexes[i]}: clipped rect`);
        }

        // combine clipped images by taking median for each pixel

        const scaleCoeff = 6;
        const clippedGrayscale = clipped.map(img => img.clone().grayscale());

        if (clipped.length !== 1) {
            console.log('Matching histograms...');
            matchHistograms(clipped);
        }
        for (let i = 0; i < clipped.length; i++) {
            clipped[i].write(`temp/clipped-${indexes[i]}.bmp`);
        }

        console.log(`Merging ${clipped.length} images...`);
        const result = new Image(width, height, inputImages[0].imageType);

        const channels = new Array(result.channelsNumber);
        for (let i = 0; i < channels.length; i++) {
            channels[i] = new Float64Array(rects.length);
        }

        result.forEachPixel((x, y) => {

            // const pixel = clipped[0].getPixel(x, y);
            // for (let i = 0; i < channels.length; i++) {
            //     channels[i][0] = pixel[i];
            // }

            for (let k = 0; k < rects.length; k++) {
                const pixel = clipped[k].getPixel(x, y);
                for (let i = 0; i < channels.length; i++) {
                    channels[i][k] = pixel[i];
                }
            }

            const resultPixel = new Float64Array(result.channelsNumber);
            for (let i = 0; i < channels.length; i++) {
                resultPixel[i] = Math.min.apply(null, channels[i]);
            }

            result.setPixel(x, y, resultPixel);
        });
        return result;
    }
}
