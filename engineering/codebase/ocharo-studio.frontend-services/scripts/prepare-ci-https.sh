#!/usr/bin/env bash
set -euo pipefail

# Trust is installed only on GitHub's disposable Linux runner, never developer machines.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_OS:-}" != "Linux" ]]; then
  printf '%s\n' 'CI HTTPS setup requires a GitHub Actions Linux runner.' >&2
  exit 1
fi
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

studio_tls_dir="$(mktemp -d "$RUNNER_TEMP/ocharo-studio-tls.XXXXXX")"
umask 077
openssl req -x509 -newkey rsa:2048 -sha256 -days 2 -nodes \
  -subj '/CN=Ocharo Studio CI root' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -keyout "$studio_tls_dir/ca.key" -out "$studio_tls_dir/ca.crt"
openssl req -newkey rsa:2048 -nodes -subj '/CN=localhost' \
  -keyout "$studio_tls_dir/localhost.key" -out "$studio_tls_dir/localhost.csr"
cat > "$studio_tls_dir/localhost.ext" <<'CERT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1
CERT
openssl x509 -req -in "$studio_tls_dir/localhost.csr" \
  -CA "$studio_tls_dir/ca.crt" -CAkey "$studio_tls_dir/ca.key" -CAcreateserial \
  -out "$studio_tls_dir/localhost.crt" -days 2 -sha256 -extfile "$studio_tls_dir/localhost.ext"
openssl verify -CAfile "$studio_tls_dir/ca.crt" "$studio_tls_dir/localhost.crt"

sudo apt-get update
sudo apt-get install --yes --no-install-recommends libnss3-tools
sudo install -m 0644 "$studio_tls_dir/ca.crt" /usr/local/share/ca-certificates/ocharo-studio-ci.crt
sudo update-ca-certificates
# Chromium M146 uses the XDG location; earlier pinned Playwright browsers use .pki.
for studio_nss_dir in "$HOME/.local/share/pki/nssdb" "$HOME/.pki/nssdb"; do
  mkdir -p "$studio_nss_dir"
  if [[ ! -f "$studio_nss_dir/cert9.db" ]]; then
    certutil -N --empty-password -d "sql:$studio_nss_dir"
  fi
  certutil -A -d "sql:$studio_nss_dir" -n 'Ocharo Studio CI root' -t 'C,,' -i "$studio_tls_dir/ca.crt"
done

# Node probes, the verified Vite proxy, Chromium, and Kestrel use the same short-lived CA.
{
  printf 'NODE_EXTRA_CA_CERTS=%s\n' "$studio_tls_dir/ca.crt"
  printf 'VITE_API_CA_PATH=%s\n' "$studio_tls_dir/ca.crt"
  printf 'STUDIO_TLS_CERT=%s\n' "$studio_tls_dir/localhost.crt"
  printf 'STUDIO_TLS_KEY=%s\n' "$studio_tls_dir/localhost.key"
  printf 'ASPNETCORE_Kestrel__Certificates__Default__Path=%s\n' "$studio_tls_dir/localhost.crt"
  printf 'ASPNETCORE_Kestrel__Certificates__Default__KeyPath=%s\n' "$studio_tls_dir/localhost.key"
} >> "$GITHUB_ENV"
