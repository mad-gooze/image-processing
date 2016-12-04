export const copyPixelToWindows = channels =>
    channels === 1 ?
        (pixel, index, windows) => windows[0][index] = pixel :
        (pixel, index, windows) => {
            for (let c = 0; c < channels; c++)
                windows[c][index] = pixel[c];
        };

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

export const sumPixel = (pixel, weight, sum) => {
    for (let i = 0; i < sum.length; i++)
        sum[i] += weight * pixel[i];
};

export const gaussian = (x, centerX = 0, sigma = 1) => Math.exp(
    -((x - centerX) ** 2) / (2 * sigma ** 2)
) / (sigma * Math.sqrt(2 * Math.PI));

export const gaussianDx = (x, centerX = 0, sigma = 1) =>
    -gaussian(x, centerX, sigma) * (x - centerX) / sigma ** 2;


export const gaussianD2x2 = (x, centerX = 0, sigma = 1) =>
    gaussian(x, centerX, sigma) * (centerX ** 2 - sigma ** 2 + x ** 2 - 2 * centerX * x) / sigma ** 4;

export const gaussianVector = (sigma = 1, derivative = 0) => {
    sigma = Math.max(1, sigma);
    let func;
    if (derivative === 0) {
        func = gaussian;
    } else if (derivative === 1) {
        func = gaussianDx;
    } else if (derivative === 2) {
        func = gaussianD2x2;
    } else {
        throw new Error(`Gaussian derivative ${derivative} is not supported`);
    }
    const radius = Math.round(sigma * 3);
    const kernel = new Float64Array(2 * radius + 1);
    for (let i = 0; i < kernel.length; i++) {
        kernel[i] = func(i, radius, sigma);
    }
    return kernel;
};

export const cubicHermite = (A, B, C, D, t) => {
    const a = -A / 2 + (3 * B) / 2 - (3 * C) / 2 + D / 2;
    const b = A - (5 * B) / 2 + 2 * C - D / 2;
    const c = -A / 2 + C / 2;
    const d = B;

    return a * t * t * t + b * t * t + c * t + d;
};