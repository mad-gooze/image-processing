import Image from './Image';
import { GRAY_SCALE } from './ImageType';

function checkCompatibility(img1, img2) {
    if ((img1.width !== img2.width) || (img1.height !== img2.height)) {
        throw new Error('Images should have equal size');
    }
    if (img1.imageType !== img2.imageType) {
        throw new Error('Images should be the same type');
    }
}

function sumOf(arr, func = a => a) {
    return arr.reduce((sum, val, i) => sum + func(val, i), 0);
}




export function mse(img1, img2) {
    checkCompatibility(img1, img2);
    let sum = 0;
    for (let i = 0; i < img1.pixelsNumber; i++) {
        for (let j = 0; j < img1.channelsNumber; j++) {
            sum += (img1._data[i * img1.channelsNumber + j] - img2._data[i * img1.channelsNumber + j]) ** 2;
        }
    }

    return sum / img1.channelsNumber / img1.pixelsNumber;
}

export function psnr(img1, img2) {
    const MSE = mse(img1, img2);
    if (MSE === 0) {
        throw new Error('Images should not be the same');
    }
    return 10 * Math.log10(1 / MSE);
}

function mean(img, x0 = 0, y0 = 0, x1 = img.width, y1 = img.height) {
    let sum = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            sum += img._data[img._coordsToIndex(x, y)];
        }
    }
    return sum / img.pixelsNumber;
}

function covariance(img1, img2, mu1, mu2, x0 = 0, y0 = 0, x1 = img1.width, y1 = img1.height) {
    let sum = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const index = img1._coordsToIndex(x, y);
            const p1 = img1._data[index];
            const p2 = img2._data[index];
            sum += (p1 - mu1) * (p2 - mu2);
        }
    }
    return sum / img1.pixelsNumber;
}

function variance(img, mu, x0 = 0, y0 = 0, x1 = img.width, y1 = img.height) {
    return covariance(img, img, mu, mu, x0, y0, x1, y1);
}

function ssimUnsafe(img1, img2, x0, y0, x1, y1) {
    const mu1 = mean(img1, x0, y0, x1, y1);
    const mu2 = mean(img2, x0, y0, x1, y1);
    const sigmaSqr1 = variance(img1, mu1, x0, y0, x1, y1);
    const sigmaSqr2 = variance(img2, mu2, x0, y0, x1, y1);
    const cov = covariance(img1, img2, mu1, mu2, x0, y0, x1, y1);

    const c1 = 0.01 ** 2;
    const c2 = 0.03 ** 2;

    return (2.0 * mu1 * mu2 + c1) * (2.0 * cov + c2) / ((mu1 ** 2 + mu2 ** 2 + c1) * (sigmaSqr1 + sigmaSqr2 + c2));
}

export function ssim(img1, img2, x0 = 0, y0 = 0, x1 = img1.width, y1 = img1.height) {
    checkCompatibility(img1, img2);
    img1 = img1.grayscale();
    img2 = img2.grayscale();
    return ssimUnsafe(img1, img2, x0, y0, x1, y1);
}

export function mssim(img1, img2) {
    checkCompatibility(img1, img2);
    const width = 4;
    img1 = img1.grayscale();
    img2 = img2.grayscale();
    const ssims = new Image(img1.width, img1.height, GRAY_SCALE);

    img1.forEachPixel((x, y) => {
        ssims._data[ssims._coordsToIndex(x, y)] = ssimUnsafe(
            img1, img2,
            Math.max(x - width, 0), Math.max(y - width, 0),
            Math.min(x + width - 1, img1.width - 1), Math.min(y + width - 1, img1.height - 1)
        );
    });

    return ssims._data.reduce((a, b) => a + b) / img1.pixelsNumber;
}