/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    testMatch: [
        "<rootDir>/test/**/*.test.ts",
    ],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    collectCoverageFrom: [
        "src/**/*.ts",
    ],
    coverageReporters: [
        "json",
        "text-summary",
    ],
};
