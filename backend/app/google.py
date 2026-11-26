from google.auth.exceptions import TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .config import settings

_request = google_requests.Request()


class GoogleTokenError(Exception):
    pass


class GoogleUnavailable(Exception):
    """Google's certificate endpoint could not be reached (not the user's fault)."""


def verify_google_credential(credential: str) -> dict:
    """Verify signature, expiry, issuer and audience of a Google ID token with Google's library.

    Returns the verified claims. Raises GoogleTokenError for anything invalid.
    Tests replace this function; production always goes through Google's certificates.
    """
    if not settings.google_configured:
        raise GoogleTokenError("Google sign-in is not configured")
    if credential.count(".") != 2:  # not even shaped like a JWT: reject without any network call
        raise GoogleTokenError("Invalid Google credential")
    try:
        claims = id_token.verify_oauth2_token(credential, _request, settings.google_oauth_client_id.strip())
    except TransportError as exc:
        raise GoogleUnavailable("Could not reach Google to verify the sign-in") from exc
    except ValueError as exc:
        raise GoogleTokenError("Invalid Google credential") from exc
    if not claims.get("sub") or not claims.get("email") or not claims.get("email_verified"):
        raise GoogleTokenError("Google account email is not verified")
    return claims
