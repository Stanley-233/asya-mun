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