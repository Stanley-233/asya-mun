# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /workspace/backend

COPY VERSION /workspace/VERSION
COPY backend/gradlew backend/settings.gradle.kts backend/build.gradle.kts ./
COPY backend/gradle ./gradle

RUN chmod +x ./gradlew

RUN --mount=type=cache,target=/root/.gradle,sharing=locked \
    ./gradlew --no-daemon dependencies

COPY backend/src ./src

RUN --mount=type=cache,target=/root/.gradle,sharing=locked \
    ./gradlew --no-daemon bootJar

FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /workspace/frontend

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
RUN pnpm config set store-dir /pnpm/store

COPY VERSION /workspace/VERSION
COPY scripts/sync-version.mjs /workspace/scripts/sync-version.mjs
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./

RUN node /workspace/scripts/sync-version.mjs --package ./package.json --version-file /workspace/VERSION

RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

COPY frontend ./
COPY VERSION_CHANGELOG.md ./public/VERSION_CHANGELOG.md

ENV SKIP_TYPE_CHECK=true
ENV NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PROXY_API_TO_BACKEND=true

RUN node /workspace/scripts/sync-version.mjs --package ./package.json --version-file /workspace/VERSION
RUN pnpm build


FROM node:24-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx-light \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PROXY_API_TO_BACKEND=true
ENV PORT=3000
ENV SERVER_PORT=8080
ENV SERVER_ADDRESS=127.0.0.1
ENV FRONTEND_INTERNAL_PORT=3001

COPY --from=backend-builder /opt/java/openjdk /opt/java/openjdk
COPY --from=backend-builder /workspace/backend/build/libs/*.jar /app/backend/

RUN set -eux; \
    find /app/backend -name "*-plain.jar" -delete; \
    jar_path="$(find /app/backend -maxdepth 1 -name "*.jar" | head -n 1)"; \
    test -n "$jar_path"; \
    mv "$jar_path" /app/backend/asya-backend.jar

COPY --from=frontend-builder /workspace/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /workspace/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /workspace/frontend/public /app/frontend/public
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY scripts/start-container.sh /app/start-container.sh

RUN chmod +x /app/start-container.sh

EXPOSE 3000

CMD ["sh", "/app/start-container.sh"]
