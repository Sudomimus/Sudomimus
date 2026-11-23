const versionDigits = (version) => version.replace(/\./g, "");

const isUniformDigitVersion = (version) => /^(\d)\1+$/.test(versionDigits(version));

const isStaircaseDigitVersion = (version) => {
    const digits = versionDigits(version);
    if (digits.length < 2) {
        return false;
    }

    const step = Number(digits[1]) - Number(digits[0]);
    if (step !== 1 && step !== -1) {
        return false;
    }

    for (let index = 1; index < digits.length; index += 1) {
        if (Number(digits[index]) - Number(digits[index - 1]) !== step) {
            return false;
        }
    }

    return true;
};

const isReservedVersion = (version) => (
    isUniformDigitVersion(version) || isStaircaseDigitVersion(version)
);

exports.isReservedVersion = isReservedVersion;
