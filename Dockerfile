FROM node:18

# 앱 디렉토리 설정
WORKDIR /app

# 먼저 example/package.json과 package-lock.json만 복사 (캐시 최적화)
COPY example/package*.json ./

# 의존성 설치
RUN npm install

# 전체 앱 소스 복사
COPY example/ .

# 앱 빌드
RUN npm run build

# 정적 파일 서버 설치
RUN npm install -g serve

# 포트 노출
EXPOSE 3000

# 정적 앱 실행 (ConfigMap 마운트 경로 /app/config를 build/config로 심링크)
CMD ["sh", "-c", "ln -sf /app/config /app/build/config && serve -s build -l 3000"]
