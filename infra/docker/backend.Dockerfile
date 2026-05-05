FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY apps/backend/pom.xml ./apps/backend/pom.xml
COPY apps/backend/src ./apps/backend/src

WORKDIR /workspace/apps/backend
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /workspace/apps/backend/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
