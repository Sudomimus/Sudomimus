package token

import "encoding/base64"

// base64url without padding — the on-wire format @sudoo/jwt 3.6+ emits for
// every JWT segment (header, body, signature).
var b64url = base64.URLEncoding.WithPadding(base64.NoPadding)
