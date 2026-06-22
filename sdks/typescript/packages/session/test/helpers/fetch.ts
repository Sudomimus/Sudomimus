/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Test_Helpers
 * @description Shared fetch / response test helpers
 */

export type FakeResponseSpec = {
    ok: boolean;
    status: number;
    body?: unknown;
    rawBody?: string;
};

export const makeFetch = (specs: FakeResponseSpec[]): jest.Mock => {

    const queue: FakeResponseSpec[] = [...specs];

    return jest.fn(async (): Promise<Response> => {

        const next: FakeResponseSpec | undefined = queue.shift();

        if (typeof next === "undefined") {

            throw new Error("makeFetch: no more responses queued");
        }

        const text: string = typeof next.rawBody === "string"
            ? next.rawBody
            : typeof next.body === "undefined"
                ? ""
                : JSON.stringify(next.body);

        return {
            ok: next.ok,
            status: next.status,
            json: async () => JSON.parse(text),
            text: async () => text,
        } as unknown as Response;
    });
};
