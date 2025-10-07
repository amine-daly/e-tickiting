@ECHO OFF
setlocal
set MAVEN_PROJECTBASEDIR=%~dp0
if not defined MAVEN_OPTS set MAVEN_OPTS=
set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_DIR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper"
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain
set DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar"

if not exist %WRAPPER_DIR% (
  mkdir %WRAPPER_DIR%
)

if not exist %WRAPPER_JAR% (
  echo Downloading Maven Wrapper...
  powershell -Command "Invoke-WebRequest -UseBasicParsing -Uri %DOWNLOAD_URL% -OutFile %WRAPPER_JAR%"
)

set JAVA_EXE=
if defined JAVA_HOME (
  set JAVA_EXE="%JAVA_HOME%\bin\java.exe"
) else (
  for /f "tokens=*" %%i in ('where java') do set JAVA_EXE=java
)

if not defined JAVA_EXE (
  echo ERROR: Java not found. Please install Java 21 or set JAVA_HOME.
  exit /b 1
)

rem Ensure MAVEN_PROJECTBASEDIR has no trailing backslash issues
for %%i in ("%MAVEN_PROJECTBASEDIR%.") do set MAVEN_PROJECTBASEDIR=%%~fi

%JAVA_EXE% %MAVEN_OPTS% -Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" -classpath %WRAPPER_JAR% %WRAPPER_LAUNCHER% %*
