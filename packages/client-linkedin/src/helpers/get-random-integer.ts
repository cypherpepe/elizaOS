export const getRandomInteger = (min: number, max: number) => {
    if (Number.isNaN(min) || Number.isNaN(max)) {
        throw new Error("Invalid range: min and max must be valid numbers");
    }

    if (min > max) {
        throw new Error("Min value cannot be greater than max value");
    }

    const lower = Math.floor(min);
    const upper = Math.floor(max);

    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};
