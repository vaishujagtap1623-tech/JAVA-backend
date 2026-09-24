FROM eclipse-temurin:17-jdk-jammy
RUN apt-get update && apt-get install -y maven nodejs npm curl tomcat9 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js .
EXPOSE 8080
CMD ["node","server.js"]
