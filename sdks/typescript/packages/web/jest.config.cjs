/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["<rootDir>/test/**/*.test.ts"],
    moduleNameMapper: {
        "^@sudomimus/connect$": "<rootDir>/../connect/src/index.ts",
        "^@sudomimus/session$": "<rootDir>/../session/src/index.ts",
        "^@sudomimus/token$": "<rootDir>/../token/src/index.ts",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
};
