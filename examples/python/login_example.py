"""Sudomimus Connect SDK — Python example.

Interactive CLI login that mirrors the Node example:

  1. Prompt the user for an applicationAnchor.
  2. Prompt the user to paste the application's client-auth private key (PEM).
  3. POST /establish (SDK signs the client-auth JWT automatically).
  4. Print the login URL — user opens it in a browser and authenticates.
  5. Poll /status-poll until REALIZED.
  6. POST /redeem and verify the issued access token.
  7. Print the subject (sector subject) as the "login succeeded" signal.
  8. Seed a RotatingConnectClient + InMemoryTokenStore from the pair, demo
     one /refresh rotation (the SDK persists the rotated pair into the
     store atomically — OAuth 2.1 BCP §4.14.2 strict mode).
  9. /logout via the rotating client, which best-effort revokes the
     current refresh token server-side and clears the store.
"""

from __future__ import annotations

import sys
import time

from sudomimus_connect import (
    ConnectClient,
    ConnectClientAuthWithKey,
    EstablishRequest,
    InMemoryTokenStore,
    RedeemRequest,
    ReturnMethodDeclaration,
    ReturnMethodStatusPoll,
    RotatingConnectClient,
    StatusPollRequest,
    TokenPair,
)

CONNECT_BASE_URL = "https://connect-api.sudomimus.com"
LOGIN_UI_BASE = "https://via.sudomimus.com"
POLL_INTERVAL_SECONDS = 2.0
PEM_END_LINE = "-----END PRIVATE KEY-----"


def read_pem(prompt: str) -> str:
    """Read a multi-line PEM block from stdin, terminated by PEM_END_LINE."""
    print(prompt)
    print(f'(Input ends automatically when a line equal to "{PEM_END_LINE}" is read.)')
    print()
    lines: list[str] = []
    for line in sys.stdin:
        lines.append(line.rstrip("\n"))
        if line.strip() == PEM_END_LINE:
            break
    return "\n".join(lines) + "\n"


def main() -> int:
    anchor = input("applicationAnchor: ").strip()
    private_key_pem = read_pem("\nPaste the application's client-auth private key PEM below.")

    with ConnectClient(
        base_url=CONNECT_BASE_URL,
        client_auth=ConnectClientAuthWithKey(
            application_anchor=anchor,
            private_key_pem=private_key_pem,
        ),
    ) as client:
        print("\nCalling /establish ...")
        established = client.establish(
            EstablishRequest(
                applicationAnchor=anchor,
                returnMethods=[ReturnMethodDeclaration(root=ReturnMethodStatusPoll(type="STATUS_POLL", payload={}))],
            )
        )

        login_url = f"{LOGIN_UI_BASE}/?exposure-key={established.exposureKey}"
        print(f"\nOpen this URL in your browser to log in:\n  {login_url}\n")
        print("Polling for completion ...")

        confirmation_key: str | None = None
        while confirmation_key is None:
            time.sleep(POLL_INTERVAL_SECONDS)
            status = client.status_poll(
                StatusPollRequest(exposureKey=established.exposureKey, hiddenKey=established.hiddenKey)
            )
            if status.root.status == "REALIZED":
                confirmation_key = status.root.confirmationKey

        print("\nInquiry realized. Calling /redeem ...")
        redeemed = client.redeem(
            RedeemRequest(
                exposureKey=established.exposureKey,
                hiddenKey=established.hiddenKey,
                confirmationKey=confirmation_key,
            )
        )
        verified = client.verify_access_token(redeemed.accessToken)
        print(f"\n✓ Login successful. subject={verified.body.subject}")

        # Demonstrate refresh-token rotation. The store would be backed
        # by a database row, Redis hash, or cookie jar in a real
        # integration — InMemoryTokenStore is fine for a short-lived CLI.
        rotating = RotatingConnectClient(client, InMemoryTokenStore())
        rotating.seed(TokenPair(access_token=redeemed.accessToken, refresh_token=redeemed.refreshToken))

        print("\nCalling /refresh ...")
        rotated_access = rotating.refresh()
        print(f"✓ Rotated. accessToken changed={rotated_access != redeemed.accessToken}")

        # Tear the session back down. Possession of the (current,
        # just-rotated) refresh token authorizes the revocation, so no
        # client-auth JWT is needed. RotatingConnectClient.logout pulls
        # the refresh token out of the store and clears the store after.
        print("\nCalling /logout ...")
        rotating.logout()
        print("✓ Session revoked.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
