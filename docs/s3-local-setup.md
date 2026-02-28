# AWS S3 local setup (backend)

This project reads S3 config from environment variables.

## Required environment variables

- `your-access-key-id`
- `your-secret-access-key`
- `AWS_REGION` (example: `eu-north-1`)
- `AWS_S3_BUCKET` (example: `eticketing-tickets-dev`)

$env:AWS_ACCESS_KEY_ID="your-access-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret-access-key"
$env:AWS_REGION="eu-north-1"
$env:AWS_S3_BUCKET="eticketing-tickets-dev"

## Run backend

From workspace root:

```powershell
Set-Location .\apps\backend
.\mvnw.cmd spring-boot:run
```

## Test endpoints

- Upload: `POST /api/files` (multipart form field name: `file`)
- List: `GET /api/files/list?maxKeys=100`
- Download: `GET /api/files?key=<object-key>`
- Delete: `DELETE /api/files?key=<object-key>`

PowerShell upload example:

```powershell
$filePath = "C:\\temp\\demo.txt"
curl.exe -X POST "http://localhost:8080/api/files" -F "file=@$filePath"
```
