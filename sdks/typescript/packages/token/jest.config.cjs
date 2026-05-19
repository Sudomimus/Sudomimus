/** @type {import("jest").Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    collectCoverageFrom: [
        "src/**/*.ts",
    ],
    coverageReporters: [
        "json",
        "text-summary",
    ],
};
