"""HTTP client for trellis-services RCM (Revenue Cycle Management) endpoints.

Proxies claim submission, eligibility checks, ERA retrieval, denial management,
and Stripe payment operations through the external trellis-services server.
Graceful no-op if RCM isn't configured.

Follows the same pattern as sms_service.py — shared httpx client, X-API-Key
header auth, and swallowed errors where appropriate.
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)

_http_client: httpx.AsyncClient | None = None


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=_TIMEOUT)
    return _http_client


async def close():
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


class RCMError(Exception):
    """Raised when an RCM API call fails."""

    def __init__(self, message: str, status_code: int | None = None, detail: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail or {}


class RCMClient:
    """Async HTTP client for trellis-services RCM endpoints."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self) -> dict:
        return {"X-API-Key": self.api_key}

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
        allow_404: bool = False,
    ) -> dict | list | None:
        """Make an authenticated request to the RCM service.

        Returns parsed JSON on success.
        Returns None if allow_404 is True and status is 404.
        Raises RCMError on failure.
        """
        url = f"{self.base_url}{path}"
        try:
            client = await _get_http_client()
            resp = await client.request(
                method,
                url,
                json=json,
                params=params,
                headers=self._headers(),
            )
            if allow_404 and resp.status_code == 404:
                return None
            if resp.status_code >= 400:
                detail = {}
                try:
                    detail = resp.json()
                except Exception:
                    pass
                raise RCMError(
                    f"RCM API error: {resp.status_code} on {method} {path}",
                    status_code=resp.status_code,
                    detail=detail,
                )
            return resp.json()
        except RCMError:
            raise
        except httpx.TimeoutException:
            logger.warning("RCM service timeout: %s %s", method, url)
            raise RCMError(f"RCM service timeout: {method} {path}", status_code=504)
        except Exception as e:
            logger.warning("RCM service error: %s %s — %s", method, url, e)
            raise RCMError(f"RCM service error: {e}", status_code=502)

    # ------------------------------------------------------------------
    # Claims
    # ------------------------------------------------------------------

    async def submit_claim(self, claim_data: dict) -> dict:
        """POST /rcm/claims/submit"""
        return await self._request("POST", "/rcm/claims/submit", json=claim_data)

    async def get_claim(self, claim_id: str) -> dict:
        """GET /rcm/claims/{claim_id}"""
        return await self._request("GET", f"/rcm/claims/{claim_id}")

    async def get_claim_by_superbill(self, superbill_id: str) -> dict | None:
        """GET /rcm/claims/by-superbill/{superbill_id} — returns None if not found."""
        return await self._request("GET", f"/rcm/claims/by-superbill/{superbill_id}", allow_404=True)

    async def check_claim_status(self, claim_id: str) -> dict:
        """POST /rcm/claims/{claim_id}/check-status"""
        return await self._request("POST", f"/rcm/claims/{claim_id}/check-status")

    # ------------------------------------------------------------------
    # Eligibility
    # ------------------------------------------------------------------

    async def check_eligibility(self, data: dict) -> dict:
        """POST /rcm/eligibility/check"""
        return await self._request("POST", "/rcm/eligibility/check", json=data)

    async def get_client_eligibility(self, client_id: str) -> dict | None:
        """GET /rcm/eligibility/client/{client_id} — returns None if not found."""
        return await self._request("GET", f"/rcm/eligibility/client/{client_id}", allow_404=True)

    # ------------------------------------------------------------------
    # Enrollments (clearinghouse)
    # ------------------------------------------------------------------

    async def list_enrollments(self) -> list[dict]:
        """GET /rcm/enrollments"""
        return await self._request("GET", "/rcm/enrollments")

    async def create_enrollment(self, data: dict) -> dict:
        """POST /rcm/enrollments"""
        return await self._request("POST", "/rcm/enrollments", json=data)

    async def get_enrollment(self, enrollment_id: str) -> dict:
        """GET /rcm/enrollments/{enrollment_id}"""
        return await self._request("GET", f"/rcm/enrollments/{enrollment_id}")

    # ------------------------------------------------------------------
    # ERA (Electronic Remittance Advice)
    # ------------------------------------------------------------------

    async def get_era(self, claim_id: str) -> dict | None:
        """GET /rcm/era/claim/{claim_id} — returns None if not found."""
        return await self._request("GET", f"/rcm/era/claim/{claim_id}", allow_404=True)

    # ------------------------------------------------------------------
    # Denials
    # ------------------------------------------------------------------

    async def list_denials(self, **filters) -> dict:
        """GET /rcm/denials"""
        # Strip None values from filters
        params = {k: v for k, v in filters.items() if v is not None}
        return await self._request("GET", "/rcm/denials", params=params or None)

    async def get_denials_by_superbill(self, superbill_id: str) -> list[dict]:
        """GET /rcm/denials/by-superbill/{superbill_id}"""
        result = await self._request(
            "GET", f"/rcm/denials/by-superbill/{superbill_id}", allow_404=True
        )
        if result is None:
            return []
        # API may return a list directly or wrapped in {"denials": [...]}
        if isinstance(result, list):
            return result
        return result.get("denials", [])

    async def generate_appeal(self, denial_id: str) -> dict:
        """POST /rcm/denials/{denial_id}/generate-appeal"""
        return await self._request("POST", f"/rcm/denials/{denial_id}/generate-appeal")

    async def update_denial(self, denial_id: str, data: dict) -> dict:
        """PATCH /rcm/denials/{denial_id}"""
        return await self._request("PATCH", f"/rcm/denials/{denial_id}", json=data)

    # ------------------------------------------------------------------
    # Stripe (direct — practice's own Stripe account)
    # ------------------------------------------------------------------

    async def stripe_status(self) -> dict:
        """GET /rcm/stripe/status"""
        return await self._request("GET", "/rcm/stripe/status")

    async def stripe_payment_link(self, data: dict) -> dict:
        """POST /rcm/stripe/payment-link"""
        return await self._request("POST", "/rcm/stripe/payment-link", json=data)


# ------------------------------------------------------------------
# Factory
# ------------------------------------------------------------------

async def get_rcm_client(pool) -> RCMClient | None:
    """Get an RCM client for the current practice.

    Returns None if the practice doesn't have billing service configured
    (no API key or no service URL).
    """
    services_url = os.getenv("TRELLIS_SERVICES_URL", "")

    # Fetch API key from the practice's billing settings.
    # In solo mode there's only one practice; grab the first configured one.
    row = await pool.fetchrow(
        """
        SELECT billing_api_key, billing_service_url
        FROM practices
        WHERE billing_api_key IS NOT NULL
        LIMIT 1
        """
    )
    if not row or not row["billing_api_key"]:
        logger.debug("RCM client not available: no billing API key configured")
        return None

    # Prefer practice-level URL, fall back to env var
    base_url = row["billing_service_url"] or services_url
    if not base_url:
        logger.debug("RCM client not available: no service URL configured")
        return None

    return RCMClient(base_url=base_url, api_key=row["billing_api_key"])


async def get_rcm_client_for_practice(pool, practice_id: str) -> RCMClient | None:
    """Get an RCM client for a specific practice by ID.

    Returns None if the practice doesn't have billing service configured.
    """
    services_url = os.getenv("TRELLIS_SERVICES_URL", "")

    row = await pool.fetchrow(
        """
        SELECT billing_api_key, billing_service_url
        FROM practices
        WHERE id = $1::uuid AND billing_api_key IS NOT NULL
        """,
        practice_id,
    )
    if not row or not row["billing_api_key"]:
        return None

    base_url = row["billing_service_url"] or services_url
    if not base_url:
        return None

    return RCMClient(base_url=base_url, api_key=row["billing_api_key"])
