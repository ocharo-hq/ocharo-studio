# syntax=docker/dockerfile:1

# Multi-stage build: ONE image serving the .NET API + the React SPA. The build
# context MUST be engineering/codebase/, which holds BOTH uzbek-studio.backend-services
# and uzbek-studio.frontend-services.
#
#   docker build -f engineering/deployment/Dockerfile -t uzbekstudio engineering/codebase
#
#   docker run --name uzbekstudio -p 127.0.0.1:18260:8080 -v uzbekstudio-data:/data uzbekstudio
#
# On first run the app creates /data/uzbekstudio.db automatically.

# ---- Stage 1: build the React SPA ----
FROM node:24-alpine AS spa
WORKDIR /src/uzbek-studio.frontend-services
RUN npm install --global npm@11.6.1
COPY uzbek-studio.frontend-services/package.json uzbek-studio.frontend-services/package-lock.json ./
RUN npm ci
COPY uzbek-studio.frontend-services/ ./
RUN npm run build

# ---- Stage 2: publish the .NET API (no Node here; the SPA arrives from stage 1) ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY uzbek-studio.backend-services/ ./
# the built SPA lands in wwwroot so `dotnet publish` bundles it into the output.
COPY --from=spa /src/uzbek-studio.backend-services/UzbekStudio.Api/wwwroot ./UzbekStudio.Api/wwwroot
RUN dotnet publish UzbekStudio.Api/UzbekStudio.Api.csproj -c Release -o /app -p:BuildSpa=false

# ---- Stage 3: runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app ./

# SQLite store on a volume so data survives container replacement.
ENV ConnectionStrings__UzbekStudio="Data Source=/data/uzbekstudio.db"
RUN mkdir -p /data && chown app:app /data
VOLUME ["/data"]

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "UzbekStudio.Api.dll"]
