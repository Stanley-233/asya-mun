# Dev
```bash
# 1. 本机 PostgreSQL 准备一个库和用户
createdb asya
# 或者自己建用户/密码，只要和下面环境变量对应就行

# 2. 跑后端
cd backend
DB_URL=jdbc:postgresql://localhost:5432/asya \
DB_USERNAME=asya \
DB_PASSWORD=你的密码 \
./gradlew bootRun

# 3. 另开一个终端跑前端
cd frontend
npm install
npm run dev
```

# Flyway
```bash
# 1. 从现有老库导出 schema，覆盖 Flyway V1
cd backend
DB_URL=jdbc:postgresql://localhost:5432/asya \
DB_USERNAME=asya \
DB_PASSWORD=你的密码 \
./scripts/export_flyway_v1.sh

# 2. 老环境首次接入 Flyway：显式开启 baseline
#    注意：只有“已有历史表结构、但还没接入 Flyway”的库才这样做。
#    如果你是全新空库/刚重置的开发库，不要设置 FLYWAY_BASELINE_ON_MIGRATE=true，
#    否则可能直接跳过 V1__init.sql，导致启动时出现 missing table。
DB_URL=jdbc:postgresql://localhost:5432/asya \
DB_USERNAME=asya \
DB_PASSWORD=你的密码 \
FLYWAY_BASELINE_ON_MIGRATE=true \
./gradlew bootRun
```
