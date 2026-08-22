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

RUN set -eux; \
    jar_path="$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' | head -n 1)"; \
    test -n "$jar_path"; \
    { jdeps --ignore-missing-deps --print-module-deps "$jar_path"; \
      printf 'java.logging,java.sql,java.naming,java.management,java.xml,java.security.jgss,java.transaction.xa,java.instrument,jdk.unsupported,java.net.http,java.rmi,java.prefs'; \
    } | tr ',' '\n' | sort -u | grep -v '^$' | paste -sd, - > /tmp/modules.txt; \
    echo "jlink modules: $(cat /tmp/modules.txt)"; \
    jlink \
      --add-modules "$(cat /tmp/modules.txt)" \
      --strip-debug \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /opt/jre

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

RUN node /workspace/scripts/sync-version.mjs --package ./package.json --version-file /workspace/VERSION
RUN pnpm build

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx-light \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/opt/jre
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV SERVER_PORT=8080
ENV SERVER_ADDRESS=127.0.0.1

COPY --from=backend-builder /opt/jre /opt/jre
COPY --from=backend-builder /workspace/backend/build/libs/*.jar /app/backend/
COPY --from=frontend-builder /workspace/frontend/out /app/frontend
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY scripts/start-container.sh /app/start-container.sh

RUN set -eux; \
    find /app/backend -name "*-plain.jar" -delete; \
    jar_path="$(find /app/backend -maxdepth 1 -name '*.jar' | head -n 1)"; \
    test -n "$jar_path"; \
    mv "$jar_path" /app/backend/asya-backend.jar

RUN chmod +x /app/start-container.sh

EXPOSE 3000

CMD ["sh", "/app/start-container.sh"]