export const RGB = 'RGB';
export const RGBA = 'RGBA';
export const GRAY_SCALE = 'GRAY_SCALE';

const channelsNum = {};
channelsNum[GRAY_SCALE] = 1;
channelsNum[RGB] = 3;
channelsNum[RGBA] = 4;

export const CHANNELS_NUMBER = channelsNum;
