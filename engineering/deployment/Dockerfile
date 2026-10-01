# syntax=docker/dockerfile:1

# Multi-stage build: ONE image serving the .NET API + the Vue SPA. The build
# context MUST be engineering/codebase/, which holds BOTH ocharo-studio.backend-services
# and ocharo-studio.frontend-services.
#
#   docker build -f engineering/deployment/Dockerfile -t ocharo-studio engineering/codebase
#
#   docker run --name ocharo-studio -p 127.0.0.1:18260:8080 ocharo-studio
#
# Studio state is stored in /app/appdata, mounted by Docker Compose.

# ---- Stage 1: build the Vue SPA ----
FROM node:24-alpine AS spa
ARG APP_VERSION
ARG VCS_REF
WORKDIR /src/ocharo-studio.frontend-services
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY ocharo-studio.frontend-services/ ./
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---- Stage 2: publish the .NET API (no Node here; the SPA arrives from stage 1) ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG APP_VERSION
ARG VCS_REF
WORKDIR /src
COPY ocharo-studio.backend-services/ ./
# the built SPA lands in wwwroot so `dotnet publish` bundles it into the output.
COPY --from=spa /src/ocharo-studio.backend-services/OcharoStudio.Api/wwwroot ./OcharoStudio.Api/wwwroot
RUN dotnet publish OcharoStudio.Api/OcharoStudio.Api.csproj -c Release -o /app -p:BuildSpa=false

# ---- Stage 3: runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
RUN apt-get update && apt-get install --yes --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
RUN mkdir -p /app/appdata && chown -R app:app /app/appdata

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "OcharoStudio.Api.dll"]
