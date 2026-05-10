# AWS EC2 auto-deploy

This repository uses the `CI` GitHub Actions workflow to build the backend and backoffice on every push, and to deploy automatically to EC2 when the push is on `sandbox`.

## What gets deployed

- Spring Boot backend
- Angular backoffice served through Nginx
- MongoDB for the application data

The production stack uses `infra/docker-compose.prod.yml`, which exposes the backoffice on port `80` and keeps MongoDB private inside the Docker network.

## GitHub secrets

Add these secrets in the repository settings:

- `EC2_HOST`: public DNS name or IP address of the instance
- `EC2_USER`: SSH user, for example `ubuntu`
- `EC2_SSH_KEY`: private SSH key for that user
- `EC2_APP_DIR`: directory where the repo will be synced, for example `/opt/e-ticketing`
- `EC2_PORT`: optional SSH port, default is `22`
- `MONGO_INITDB_ROOT_USERNAME`: Mongo root user used by the production stack
- `MONGO_INITDB_ROOT_PASSWORD`: Mongo root password used by the production stack
- `JWT_SECRET`: secret used by the backend to sign JWTs
- `AWS_ACCESS_KEY_ID`: IAM access key with S3 permissions for uploads/downloads
- `AWS_SECRET_ACCESS_KEY`: IAM secret key paired with the access key above
- `AWS_SESSION_TOKEN`: optional, only if you are using temporary STS credentials
- `AWS_REGION`: AWS region for the S3 bucket, for example `eu-north-1`
- `AWS_S3_BUCKET`: S3 bucket used by the upload service
- `MONGO_DB_NAME`: optional Mongo database name, defaults to `eticketing`
- `SPRING_PROFILES_ACTIVE`: optional Spring profile, defaults to `prod`
- `FRONTEND_HOST_PORT`: optional host port for the backoffice, defaults to `80`

## EC2 setup

1. Install Docker and the Docker Compose plugin on the instance.
2. Create the deploy directory from the value in `EC2_APP_DIR`.
3. Open inbound port `80` in the security group, or whichever port you plan to use for `FRONTEND_HOST_PORT`. Keep `22` open for SSH. Leave `8080` closed unless you explicitly want direct backend access.

The GitHub Actions deploy job now generates the production `.env` file on the EC2 instance from repository secrets before running Docker Compose, so you do not need to create it by hand once the secrets are configured.
Those same secrets are passed into the backend container, which is what the AWS SDK uses when uploading or downloading files from S3.

Example `.env` values:

```env
MONGO_INITDB_ROOT_USERNAME=eticketing
MONGO_INITDB_ROOT_PASSWORD=use-a-strong-password
MONGO_DB_NAME=eticketing
JWT_SECRET=use-a-long-random-secret
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=eu-north-1
AWS_S3_BUCKET=eticketing-app
SPRING_PROFILES_ACTIVE=prod
```

## How deployment works

On each push to `sandbox`, GitHub Actions:

1. Runs the build checks.
2. Syncs the repository contents to the EC2 directory over SSH.
3. Writes the production `.env` file to the EC2 directory from GitHub Secrets.
4. Runs `scripts/deploy-ec2.sh` on the instance.
5. Rebuilds and restarts the Docker Compose stack.

The deploy script defaults to `infra/docker-compose.prod.yml`. If you ever need to point it at another compose file, set `COMPOSE_FILE` on the server before running it.

## First deploy check

After the first deploy, verify the backoffice at `http://<ec2-host>/` and confirm the backend responds through the `/api` path.

## Connect MongoDB Compass to EC2

MongoDB is published only on the EC2 loopback interface, so connect to it from your laptop through an SSH tunnel:

```bash
ssh -N -L 27017:127.0.0.1:27017 ubuntu@<ec2-host>
```

Then use this connection string in MongoDB Compass:

```text
mongodb://<MONGO_INITDB_ROOT_USERNAME>:<MONGO_INITDB_ROOT_PASSWORD>@localhost:27017/?authSource=admin
```

Replace the username and password with the values from your GitHub Secrets or the EC2 `.env` file. Keep the SSH session open while Compass is connected.
