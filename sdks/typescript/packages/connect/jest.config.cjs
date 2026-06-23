/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    testMatch: [
        "<rootDir>/test/**/*.test.ts",
    ],
    moduleNameMapper: {
        "^@sudomimus/token$": "<rootDir>/../token/src/index.ts",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/_generated/**",
    ],
    coverageReporters: [
        "json",
        "text-summary",
    ],
};
