/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Token
 * @description Parsed application JWT container
 */

import { createVerify } from "node:crypto";

export class ApplicationToken<
    Header extends Record<string, unknown>,
    Body extends { readonly exp: number },
> {

    public readonly rawToken: string;
    public readonly signingInput: Buffer;
    public readonly signature: Buffer;
    public readonly header: Header;
    public readonly body: Body;

    public constructor(
        rawToken: string,
        signingInput: Buffer,
        signature: Buffer,
        header: Header,
        body: Body,
    ) {

        this.rawToken = rawToken;
        this.signingInput = signingInput;
        this.signature = signature;
        this.header = header;
        this.body = body;
    }

    public static parse(jwt: string): ApplicationToken<Record<string, unknown>, Record<string, unknown> & { exp: number }> | null {

        const segments = jwt.split(".");

        if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {

            return null;
        }

        try {

            const header: unknown = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8"));
            const body: unknown = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));

            if (typeof header !== "object" || header === null || Array.isArray(header)
                || typeof body !== "object" || body === null || Array.isArray(body)) {

                return null;
            }

            return new ApplicationToken(
                jwt,
                Buffer.from(`${segments[0]}.${segments[1]}`, "ascii"),
                Buffer.from(segments[2], "base64url"),
                header as Record<string, unknown>,
                body as Record<string, unknown> & { exp: number },
            );
        } catch {

            return null;
        }
    }

    public verifySignature(publicKeyPem: string): boolean {

        return createVerify("RSA-SHA256")
            .update(this.signingInput)
            .verify(publicKeyPem, this.signature);
    }

    public verifyExpiration(now: Date = new Date()): boolean {

        return Number.isInteger(this.body.exp) && this.body.exp * 1000 > now.getTime();
    }
}
