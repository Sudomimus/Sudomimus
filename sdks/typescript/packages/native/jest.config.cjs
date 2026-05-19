/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    testMatch: [
        "<rootDir>/test/**/*.test.ts",
    ],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/_generated/**",
    ],
    coverageReporters: [
        "json",
        "text-summary",
    ],
};
