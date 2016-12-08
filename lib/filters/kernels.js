export const SOBEL = [
    [
        Float64Array.from([1, 2, 1]),
        Float64Array.from([-1, 0, 1])
    ],
    [
        Float64Array.from([-1, 0, 1]),
        Float64Array.from([1, 2, 1])
    ]
];

export const PREWITT = [
    [
        Float64Array.from([1, 1, 1]),
        Float64Array.from([-1, 0, 1])
    ],
    [
        Float64Array.from([-1, 0, 1]),
        Float64Array.from([1, 1, 1])
    ]
];

export const ROBERTS = [
    [
        Float64Array.from([+1, 0]),
        Float64Array.from([0, -1])
    ],
    [
        Float64Array.from([0, +1]),
        Float64Array.from([-1, 0])
    ]
];
