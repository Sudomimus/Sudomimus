/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    testMatch: [
        "<rootDir>/test/**/*.test.ts",
    ],
    moduleNameMapper: {
        "^@sudomimus/connect$": "<rootDir>/../connect/src/index.ts",
        "^@sudomimus/token$": "<rootDir>/../token/src/index.ts",
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
