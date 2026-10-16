FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
ENV PORT=8080
EXPOSE 8080

COPY --from=build /workspace/target/contextos-backend-0.1.0.jar /app/app.jar

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
