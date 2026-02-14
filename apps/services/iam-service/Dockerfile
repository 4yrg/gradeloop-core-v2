FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

# Cache Maven deps by copying only the files required for dependency resolution first
COPY pom.xml ./
COPY .mvn .mvn
COPY mvnw ./

# Copy sources and build
COPY src ./src
RUN chmod +x mvnw && ./mvnw -B -DskipTests clean package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy the built Spring Boot jar (use wildcard to be resilient to versioned names)
COPY --from=builder /workspace/target/*.jar ./app.jar

EXPOSE 8080
ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
