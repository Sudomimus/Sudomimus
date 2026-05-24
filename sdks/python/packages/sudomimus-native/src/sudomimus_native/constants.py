"""Native client constants."""

from __future__ import annotations

PRODUCTION_BASE_URL = "https://native-api.sudomimus.com"

# Identity string the client SDK MUST pass to
# ``ISteamUser::GetAuthTicketForWebApi(identity)``. Steam binds the issued
# ticket to this identity and the Native API verifier hardcodes the same
# value, so tickets generated with any other identity are rejected.
STEAM_TICKET_IDENTITY = "sudomimus"
