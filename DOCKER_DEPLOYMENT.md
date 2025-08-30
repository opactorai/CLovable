# claudable docker deployment guide

## quick start - one click run

### prerequisites
- docker and docker compose installed
- claude api key from anthropic

### 1. pull and run (easiest method)

```bash
# pull the latest image
docker pull ghcr.io/opactorai/claudable:latest

# run with your api key
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY="your-claude-api-key-here" \
  -v claudable-data:/app/data \
  --name claudable \
  ghcr.io/opactorai/claudable:latest
```

### 2. using docker compose

create a `.env` file:
```bash
ANTHROPIC_API_KEY=your-claude-api-key-here
```

create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  claudable:
    image: ghcr.io/opactorai/claudable:latest
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - claudable-data:/app/data
    restart: unless-stopped

volumes:
  claudable-data:
```

run:
```bash
docker compose up -d
```

## access the application

- **frontend**: http://localhost:3000
- **api**: http://localhost:8080
- **api docs**: http://localhost:8080/docs

## build from source

```bash
# clone repository
git clone https://github.com/opactorai/claudable.git
cd claudable

# build image
docker build -t claudable:local .

# run with docker compose
docker compose up -d
```

## environment variables

| variable | description | required | default |
|----------|-------------|----------|---------|
| `ANTHROPIC_API_KEY` | claude api key for ai functionality | yes | - |
| `NEXT_PUBLIC_API_URL` | backend api url | no | http://localhost:8080 |
| `API_PORT` | api server port | no | 8080 |
| `WEB_PORT` | web server port | no | 3000 |

## data persistence

the sqlite database is stored in `/app/data` inside the container. to persist data:

```bash
# named volume (recommended)
docker run -v claudable-data:/app/data ...

# or bind mount
docker run -v $(pwd)/data:/app/data ...
```

## stopping and removing

```bash
# stop container
docker stop claudable

# remove container
docker rm claudable

# remove image
docker rmi ghcr.io/opactorai/claudable:latest
```

## troubleshooting

### ports already in use
change the port mapping:
```bash
docker run -p 3001:3000 -p 8081:8080 ...
```

### permission issues
ensure the data directory has correct permissions:
```bash
docker exec claudable chown -R nextjs:nodejs /app/data
```

### api connection issues
verify the api is accessible:
```bash
docker logs claudable
curl http://localhost:8080/docs
```

## security notes

- **never commit** your `.env` file with api keys
- use docker secrets for production deployments
- regularly update the base image for security patches
- consider using a reverse proxy for production

## support

- github issues: https://github.com/opactorai/claudable/issues
- discord: https://discord.gg/njnbafhnqc