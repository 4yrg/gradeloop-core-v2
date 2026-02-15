FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

# Copy pom and source files
COPY pom.xml ./
COPY mvnw ./
COPY .mvn .mvn

# Cache Maven deps by copying only the files required for dependency resolution first
RUN chmod +x mvnw && ./mvnw -B -DskipTests dependency:go-offline

# Copy sources and build
COPY src ./src
RUN ./mvnw -B -DskipTests clean package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy the built Spring Boot jar
COPY --from=builder /workspace/target/*.jar ./app.jar

# Copy public key for JWT validation
COPY src/main/resources/public_key.pem ./public_key.pem

EXPOSE 8080

ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
