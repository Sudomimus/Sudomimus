import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The @sudomimus/connect and @sudomimus/session SDKs statically import Node's
// `crypto` module (used by built-in client-auth JWT helpers).
// In the browser those code paths are unreachable because this example
// passes a BYO signer (SubtleCrypto-based) and decodes the access token
// inline, but Vite still has to resolve the `crypto` import. Alias it to
// a stub that throws if anything ever calls into it.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: [
            {
                find: /^node:crypto$/,
                replacement: fileURLToPath(new URL("./src/shims/node-crypto-stub.ts", import.meta.url)),
            },
            {
                find: /^crypto$/,
                replacement: fileURLToPath(new URL("./src/shims/node-crypto-stub.ts", import.meta.url)),
            },
        ],
    },
    server: {
        port: 5173,
    },
});
