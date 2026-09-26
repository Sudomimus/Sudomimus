import { useEffect, useState } from "react";

type User = { subject: string };

export const App = () => {
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/auth/me", { credentials: "same-origin" })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Session check failed (${response.status})`);
                return response.json() as Promise<User | null>;
            })
            .then(setUser)
            .catch((reason: unknown) => setError(String(reason)));
    }, []);

    return (
        <main>
            <h1>Sudomimus Connect — React example</h1>
            {error && <p role="alert">{error}</p>}
            {user === undefined && !error && <p>Checking session…</p>}
            {user === null && (
                <form action="/auth/start" method="post">
                    <button type="submit">Log in</button>
                </form>
            )}
            {user && (
                <>
                    <p>Logged in as {user.subject}</p>
                    <form action="/auth/logout" method="post">
                        <button type="submit">Log out</button>
                    </form>
                </>
            )}
        </main>
    );
};
