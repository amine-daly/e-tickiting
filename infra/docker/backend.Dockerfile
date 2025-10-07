# Backend Dockerfile (placeholder - will be finalized after app is generated)
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY apps/backend /app
# RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
