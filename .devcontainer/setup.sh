#!/usr/bin/env bash
# Prepara o Codespaces: pnpm, dependências e .env de desenvolvimento.
# O banco local (container `db`) sobe no postStart; nada aqui toca em bancos externos.
set -euo pipefail

corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile

if [ ! -f .env ]; then
  cp .env.example .env

  # No Codespaces o navegador acessa a aplicação pela URL encaminhada da porta 7002.
  if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
    origin="https://${CODESPACE_NAME}-7002.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    for key in OPENMONETIS_URL BETTER_AUTH_URL WEB_URL CORS_ORIGIN; do
      sed -i "s|^${key}=.*|${key}=${origin}|" .env
    done

    # O proxy do Codespace entrega a origem como localhost à API; sem isto o login falha com
    # INVALID_ORIGIN.
    sed -i "s|^BETTER_AUTH_TRUSTED_ORIGINS=.*|BETTER_AUTH_TRUSTED_ORIGINS=https://localhost:7002,http://localhost:7002|" .env
  fi
fi

echo "Pronto. Suba o banco e a aplicação com: pnpm docker:db && pnpm db:migrate && pnpm dev"
