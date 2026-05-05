# AWS EC2 auto-deploy

This repository uses the `CI` GitHub Actions workflow to build the backend and frontend on every push, and to deploy automatically to EC2 when the push is on `main`.

## What gets deployed

- Spring Boot backend
- Angular frontend served through Nginx
- MongoDB for the application data

The production stack uses `infra/docker-compose.prod.yml`, which exposes the frontend on port `80` and keeps MongoDB private inside the Docker network.

## GitHub secrets

Add these secrets in the repository settings:

- `EC2_HOST`: public DNS name or IP address of the instance
- `EC2_USER`: SSH user, for example `ubuntu`
- `EC2_SSH_KEY`: private SSH key for that user
- `EC2_APP_DIR`: directory where the repo will be synced, for example `/opt/e-ticketing`
- `EC2_PORT`: optional SSH port, default is `22`

## EC2 setup

1. Install Docker and the Docker Compose plugin on the instance.
2. Create the deploy directory from the value in `EC2_APP_DIR`.
3. Create a `.env` file in that directory based on [.env.example](../.env.example).
4. Open inbound port `80` in the security group. Keep `22` open for SSH. Leave `8080` closed unless you explicitly want direct backend access.

Example `.env` values:

```env
MONGO_INITDB_ROOT_USERNAME=eticketing
MONGO_INITDB_ROOT_PASSWORD=use-a-strong-password
MONGO_DB_NAME=eticketing
JWT_SECRET=use-a-long-random-secret
SPRING_PROFILES_ACTIVE=prod
```

## How deployment works

On each push to `main`, GitHub Actions:

1. Runs the build checks.
2. Syncs the repository contents to the EC2 directory over SSH.
3. Runs `scripts/deploy-ec2.sh` on the instance.
4. Rebuilds and restarts the Docker Compose stack.

The deploy script defaults to `infra/docker-compose.prod.yml`. If you ever need to point it at another compose file, set `COMPOSE_FILE` on the server before running it.

## First deploy check

After the first deploy, verify the site at `http://<ec2-host>/` and confirm the backend responds through the `/api` path.
