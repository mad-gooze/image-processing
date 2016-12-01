import Image from './lib/Image';
import yargs from 'yargs';
import { mse, psnr, ssim, mssim } from './lib/Metrics';
import { PREWITT, ROBERTS, SOBEL } from './lib/filters/kernels';

console.profile = console.profile || (() => {});
console.profileEnd = console.profileEnd || (() => {});

const help = `
%programname% (input_image) (output_image) (command) [parameters...]

invert                        Инверсия пикселей
mirror {x|y}                  Отражение по горизонтали или по вертикали, в зависомсти от указанного параметра
rotate {cw|ccw} (angle)       Поворот по или против часовой стрелки на заданное количество градусов, например: rotate cw 90
prewitt {x|y}                 Фильтр Превитта, обнаруживающий горизонтальные или вертикальные контуры
sobel {x|y}                   Фильтр Собеля, обнаруживающий горизонтальные или вертикальные контуры
roberts {1|2}                 Фильтр Робертса, параметр — выбор диагонали
median (rad)                  Медианная фильтрация, параметр rad — целочисленный радиус фильтра
gauss (sigma)                 Фильтр Гаусса, параметр sigma — вещественный параметр фильтра
gradient (sigma)              Модуль градиента
eqhist                        Эквализация гистограммы
up_bilinear {s}               Увеличение с помощью билинейной интерполяции в s раз
up_bicubic {s}                Увеличение с помощью бикубической интерполяции в s раз
downsample {s}                Уменьшение в s раз
metric {mse|psnr|ssim|mssim}  Вычисление метрики между двумя входными изображениями, результат выводится числом на экран
`;


(async function () {
    const args = yargs.argv._;
    if (args.length < 3) {
        console.log(help);
    } else {
        const img1 = args[0];
        const img2 = args[1];
        const command = args[2];

        if (command === 'metric') {
            const metric = args[3];

            const input1 = await Image.fromFile(img1);
            const input2 = await Image.fromFile(img2);
            console.time(metric);

            switch(metric) {
                case 'mse':
                    console.log(mse(input1, input2));
                    break;
                case 'psnr':
                    console.log(psnr(input1, input2));
                    break;
                case 'ssim':
                    console.log(ssim(input1, input2));
                    break;
                case 'mssim':
                    console.log(mssim(input1, input2));
                    break;
            }

            console.timeEnd(metric);

        } else {
            const input = await Image.fromFile(img1);
            console.time(command);

            switch (command) {
                case 'invert':
                    input.invert();
                    break;

                case 'mirror':
                    input.mirror(args[3] !== 'x');
                    break;

                case 'rotate':
                    let angle = Number.parseFloat(args[4]);
                    if (args[3] === 'cw') {
                        angle *= -1;
                    }
                    input.rotate(angle);
                    break;

                case 'prewitt':
                    input
                        .grayscale()
                        .convolveSeparable(PREWITT[args[3] === 'x' ? 0 : 1])
                        .normalize();
                    break;

                case 'sobel':
                    input
                        .grayscale()
                        .convolveSeparable(SOBEL[args[3] === 'x' ? 0 : 1])
                        .normalize();
                    break;

                case 'roberts':
                    input
                        .grayscale()
                        .convolve(ROBERTS[args[3] === '1' ? 0 : 1])
                        .normalize();
                    break;

                case 'median':
                    input.median(Number(args[3]));
                    break;

                case 'gauss':
                    input.gaussian(Number.parseFloat(args[3]));
                    break;

                case 'gradient':
                    input.gradientMagnitude(Number.parseFloat(args[3]));
                    break;

                case 'eqhist':
                    input.equalizeHistogram();

                case 'up_bilinear':
                    input.bilinearInterpolation(Number.parseFloat(args[3]));

                case 'up_bicubic':
                    input.bicubicInterpolation(Number.parseFloat(args[3]));

                case 'downsample':
                    input.bilinearInterpolation(1 / Number.parseFloat(args[3]));
            }


            console.timeEnd(command);
            await input.write(img2);
        }

    }
})();