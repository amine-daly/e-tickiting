<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

- [x] Verify that the copilot-instructions.md file in the .github directory is created.
  - Done: File created and being used to track setup progress.

- [x] Clarify Project Requirements
  <!-- Ask for project type, language, and frameworks if not specified. Skip if already provided. -->
  - Done: Requirements provided by user (Angular + Spring Boot + MongoDB, production-ready, 10-epic roadmap).

- [x] Scaffold the Project
  <!--
  Ensure that the previous step has been marked as completed.
  Call project setup tool with projectType parameter.
  Run scaffolding command to create project files and folders.
  Use '.' as the working directory.
  If no appropriate projectType is available, search documentation using available tools.
  Otherwise, create the project structure manually using available file creation tools.
  -->
  - Done: Created monorepo structure (apps/safra via Angular CLI with SSR; apps/backend Spring Boot skeleton; infra/docker-compose; Dockerfiles; contracts/openapi.yaml; docs; .vscode settings; CI workflow; root README and env examples).

- [x] Customize the Project
  <!--
  Verify that all previous steps have been completed successfully and you have marked the step as completed.
  Develop a plan to modify codebase according to user requirements.
  Apply modifications using appropriate tools and user-provided references.
  Skip this step for "Hello World" projects.
  -->
  - Done (phase 1): Added minimal endpoints (/api/health, /api/auth/register, /api/auth/login, /api/users/me, /api/search/trips) and Angular pages (landing, auth, search, results) with proxy and interceptor.
  - Next: Add Material, Tailwind, NgRx, i18n, and full domain modules.

- [x] Install Required Extensions
  <!-- ONLY install extensions provided mentioned in the get_project_setup_info. Skip this step otherwise and mark as completed. -->
  - Skipped: No extensions were mandated by setup tool. Recommendations added in .vscode/extensions.json.

- [x] Compile the Project
  <!--
  Verify that all previous steps have been completed.
  Install any missing dependencies.
  Run diagnostics and resolve any issues.
  Check for markdown files in project folder for relevant instructions on how to do this.
  -->
  - Frontend: Build successful (Angular 17 + SSR output produced).
  - Backend: Build successful (Spring Boot 3.3 + Java 21 via Maven Wrapper). App runs on http://localhost:8080.

- [x] Create and Run Task
  <!--
  Verify that all previous steps have been completed.
  Check https://code.visualstudio.com/docs/debugtest/tasks to determine if the project needs a task. If so, use the create_and_run_task to create and launch a task based on package.json, README.md, and project structure.
  Skip this step otherwise.
   -->
  - Done: Added tasks for backend build/run and frontend start. Compound task 'dev:full' starts both.

- [x] Launch the Project
  <!--
  Verify that all previous steps have been completed.
  Prompt user for debug mode, launch only if confirmed.
   -->
  - Done: Backend verified running; Swagger UI available. Frontend start task available.

- [x] Ensure Documentation is Complete
  - Done: README, roadmap, architecture, contributing, security docs all present and up to date.

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
