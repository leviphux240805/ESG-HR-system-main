FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Gói 512MB (Render free): giới hạn heap, GC nhẹ, bớt bộ nhớ JIT
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
