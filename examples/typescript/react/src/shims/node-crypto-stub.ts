/**
 * Stub for Node's `crypto` module. The React example never executes the SDK
 * code paths that use `crypto.createHash` / `createSign` / `createVerify`
 * because it passes a BYO SubtleCrypto-based signer and decodes the access
 * token inline. If any of these are ever invoked, throw a clear error
 * instead of silently bundling a broken Node-style crypto polyfill.
 */

const unsupported = (name: string): never => {
    throw new Error(
        `[example/react] Node "${name}" is not available in the browser. The example bypasses SDK crypto via a BYO signer; check that your code is not falling back to the built-in Node crypto path.`,
    );
};

export const createHash = (): never => unsupported("crypto.createHash");
export const createSign = (): never => unsupported("crypto.createSign");
export const createVerify = (): never => unsupported("crypto.createVerify");

// @sudomimus/connect uses crypto.randomUUID() to generate JWT `jti`s. The
// BYO signer in this example uses globalThis.crypto.randomUUID directly, so
// the SDK helper never reaches this stub — but expose a delegating impl
// just in case.
export const randomUUID = (): string => globalThis.crypto.randomUUID();

export default {
    createHash,
    createSign,
    createVerify,
    randomUUID,
};
