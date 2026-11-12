#!/usr/bin/env bash
# Promote a release that is already on one Google Play track to another,
# without uploading a bundle. Used by release-prod.yml to move the build that
# testers got on the internal track to production.
#
# It checks that the source track holds VERSION_CODE in a completed release
# (built from EXPECTED_COMMIT, when given), then sets the destination track to
# that same version and commits the edit. Needs only bash, curl, openssl and
# jq. Nothing from the credential is printed.
#
# Play replaces the destination track's whole release list with the one release
# set here, so this is a 100% rollout of that version and supersedes anything
# else on the track, a staged rollout or a draft included.
#
# Environment:
#   SERVICE_ACCOUNT_JSON  the Play service account key (required)
#   PACKAGE_NAME          the app's package name (required)
#   VERSION_CODE          the versionCode to promote (required)
#   RELEASE_NAME          the release name shown in Play Console (required)
#   EXPECTED_COMMIT       when set, the source release's name must contain its
#                         first 12 characters (UAT puts the commit in the name)
#   FROM_TRACK            source track, default internal
#   TO_TRACK              destination track, default production
#   STATUS                completed (default) or draft
#   PROMOTE_ALLOW_TEST_ENDPOINTS=1, PLAY_API_BASE, TOKEN_URL
#                         point the script at a mock; only for tests

set -euo pipefail
umask 077

: "${SERVICE_ACCOUNT_JSON:?SERVICE_ACCOUNT_JSON is not set}"
: "${PACKAGE_NAME:?PACKAGE_NAME is not set}"
: "${VERSION_CODE:?VERSION_CODE is not set}"
: "${RELEASE_NAME:?RELEASE_NAME is not set}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-}"
FROM_TRACK="${FROM_TRACK:-internal}"
TO_TRACK="${TO_TRACK:-production}"
STATUS="${STATUS:-completed}"
API="https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
TOKEN_URL="https://oauth2.googleapis.com/token"
if [ "${PROMOTE_ALLOW_TEST_ENDPOINTS:-}" = "1" ]; then
  API="${PLAY_API_BASE:-$API}"
  TOKEN_URL="${TOKEN_URL_OVERRIDE:-$TOKEN_URL}"
fi

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "VERSION_CODE must be a number, not '$VERSION_CODE'" >&2
  exit 1
fi
case "$STATUS" in
  completed | draft) ;;
  *)
    echo "STATUS must be completed or draft, not '$STATUS'" >&2
    exit 1
    ;;
esac
for track in "$FROM_TRACK" "$TO_TRACK"; do
  if ! [[ "$track" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "A track name may only hold letters, digits, - and _, not '$track'" >&2
    exit 1
  fi
done
if [ "$FROM_TRACK" = "$TO_TRACK" ]; then
  echo "FROM_TRACK and TO_TRACK are both '$FROM_TRACK'" >&2
  exit 1
fi

work="$(mktemp -d)"
edit_id=""
committed=""

cleanup() {
  # Drop an edit that was opened but never committed, so it does not linger.
  if [ -n "$edit_id" ] && [ -z "$committed" ] && [ -f "$work/auth" ]; then
    curl --silent --show-error -X DELETE -H @"$work/auth" \
      "$API/$PACKAGE_NAME/edits/$edit_id" > /dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# Print the response body on success. On failure print Google's error message
# (it carries no secret) and fail, so a 403 says why instead of "curl: (22)".
request() {
  local status
  if ! status="$(curl --silent --show-error -o "$work/resp" -w '%{http_code}' "$@")"; then
    echo "The request could not be sent" >&2
    return 1
  fi
  case "$status" in
    2??) cat "$work/resp" ;;
    *)
      echo "Google returned HTTP $status: $(jq -r '.error.message // .error_description // .error // empty' "$work/resp" 2> /dev/null)" >&2
      return 1
      ;;
  esac
}
api() { request -H @"$work/auth" -H 'Content-Type: application/json' "$@"; }

# --- access token: a signed JWT exchanged for a short-lived token -------------
jq -er '.private_key' <<< "$SERVICE_ACCOUNT_JSON" > "$work/key.pem" || {
  echo "SERVICE_ACCOUNT_JSON has no private_key" >&2
  exit 1
}
email="$(jq -er '.client_email' <<< "$SERVICE_ACCOUNT_JSON")" || {
  echo "SERVICE_ACCOUNT_JSON has no client_email" >&2
  exit 1
}

now="$(date +%s)"
header="$(printf '%s' '{"alg":"RS256","typ":"JWT"}' | b64url)"
claims="$(jq -nc --arg iss "$email" --arg aud "$TOKEN_URL" --argjson iat "$now" \
  '{iss: $iss, scope: "https://www.googleapis.com/auth/androidpublisher", aud: $aud, iat: $iat, exp: ($iat + 3600)}' | b64url)"
signature="$(printf '%s' "$header.$claims" | openssl dgst -sha256 -sign "$work/key.pem" | b64url)"
# The assertion goes through a file, so it is not on the command line.
printf '%s' "$header.$claims.$signature" > "$work/jwt"

token="$(request -X POST "$TOKEN_URL" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" \
  --data-urlencode "assertion@$work/jwt" | jq -er '.access_token')" || {
  echo "Could not get an access token for the service account" >&2
  exit 1
}
echo "::add-mask::$token"
# A header file keeps the token off the command line.
printf 'Authorization: Bearer %s\n' "$token" > "$work/auth"

# --- promote inside one edit ----------------------------------------------------
edit_id="$(api -X POST -d '{}' "$API/$PACKAGE_NAME/edits" | jq -er '.id')" || {
  echo "Play did not open an edit" >&2
  exit 1
}

source_track="$(api "$API/$PACKAGE_NAME/edits/$edit_id/tracks/$FROM_TRACK")"
holds="$(jq --arg code "$VERSION_CODE" --arg sha "${EXPECTED_COMMIT:0:12}" \
  '[.releases[]?
    | select(.status == "completed"
        and ((.versionCodes // []) | index($code))
        and ($sha == "" or ((.name // "") | contains($sha))))] | length' \
  <<< "$source_track")"
if [ "$holds" = "0" ]; then
  echo "The $FROM_TRACK track does not hold versionCode $VERSION_CODE in a completed release${EXPECTED_COMMIT:+ built from commit ${EXPECTED_COMMIT:0:12}}." >&2
  echo "It must be on $FROM_TRACK as the newest release (a newer one replaces it there) and rolled out, not a draft." >&2
  exit 1
fi

body="$(jq -nc --arg track "$TO_TRACK" --arg name "$RELEASE_NAME" --arg code "$VERSION_CODE" \
  --arg status "$STATUS" \
  '{track: $track, releases: [{name: $name, versionCodes: [$code], status: $status}]}')"
api -X PUT -d "$body" "$API/$PACKAGE_NAME/edits/$edit_id/tracks/$TO_TRACK" > /dev/null
# The empty body is needed: without one Google answers 411 Length Required.
api -X POST -d '' "$API/$PACKAGE_NAME/edits/$edit_id:commit" > /dev/null
committed=1

echo "Promoted versionCode $VERSION_CODE from $FROM_TRACK to $TO_TRACK as $RELEASE_NAME ($STATUS)."
