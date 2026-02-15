FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /workspace

# Copy pom and resolve dependencies
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy the built Spring Boot jar
COPY --from=builder /workspace/target/*.jar ./app.jar

EXPOSE 8761

ENV JAVA_OPTS="-Xms256m -Xmx512m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
