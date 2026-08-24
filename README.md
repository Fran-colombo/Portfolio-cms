# Portfolio CMS

A lightweight full-stack portfolio and CMS for showcasing software projects. All project content is stored in a SQLite database and served through a REST API — no hardcoded project data in the frontend.

## Architecture

```
portfolio-cms/
├── backend/          # FastAPI REST API + SQLite
├── frontend/         # React + Vite public site + admin panel
├── data/             # Persistent SQLite database (Docker volume)
├── Caddyfile         # HTTPS reverse proxy (Let's Encrypt)
└── docker-compose.yml
```

**Stack:** React 18, Vite, FastAPI, SQLAlchemy, SQLite, JWT authentication, Docker.

### Data flow

1. Public pages fetch live projects from `GET /api/projects`
2. Incoming (in-progress) projects from `GET /api/projects/incoming`
3. Project detail pages fetch by slug from `GET /api/projects/{slug}`
4. Admin logs in via JWT at `/admin/login`, manages projects through the admin panel
5. New or updated projects appear on the public site immediately (when published)

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List published live projects (with demos) |
| GET | `/api/projects/incoming` | List published in-progress projects |
| GET | `/api/projects/{slug}` | Get published project by slug |
| GET | `/api/health` | Health check |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email and password |
| GET | `/api/auth/me` | Get current admin user (JWT required) |

### Admin (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/projects` | List all projects (including drafts) |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| PATCH | `/api/projects/{id}/publish` | Toggle published status |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing secret (use a long random string) |
| `DATABASE_URL` | SQLite connection string |
| `ADMIN_EMAIL` | Initial admin email (used on first seed) |
| `ADMIN_PASSWORD` | Initial admin password (hashed before storage) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `JWT_ALGORITHM` | JWT algorithm (default: HS256) |
| `JWT_EXPIRE_HOURS` | Token expiry in hours (default: 24) |

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

cd ..
copy .env.example .env        # edit SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD

cd backend
uvicorn app.main:app --reload --port 8000
```

The database is seeded automatically on startup with the admin user only (no sample projects).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173` and proxies `/api` requests to the backend.

## Admin Login

The admin panel is at **`/admin/login`** (also linked discreetly in the site footer).

1. Go to `http://localhost:5173/admin/login` (dev) or `http://your-domain/admin/login` (production)
2. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` file
3. Use the dashboard to create, edit, publish, and delete projects

## Adding Projects

### Live project (with demo)

1. Log in at `/admin/login`
2. Click **New project**
3. Fill in title, descriptions, technologies, demo URL, etc.
4. Check **Published** — leave **Incoming** unchecked
5. Save — the project appears in the **Live projects** section

### Incoming project (in progress, no demo yet)

1. Log in at `/admin/login`
2. Click **New project**
3. Fill in title, descriptions, technologies (no demo URL needed)
4. Check **Published** and **Incoming (in progress, no demo yet)**
5. Save — the project appears in the **Incoming** section

When the project is deployed, edit it: add the demo URL and uncheck **Incoming**.

## Docker Deployment (local / VPS)

1. Copy environment file:

```bash
cp .env.example .env
```

2. Edit `.env` with your production values:

```env
SECRET_KEY=your-long-random-secret-here
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=your-secure-password
DATABASE_URL=sqlite:////app/data/portfolio.db
CORS_ORIGINS=https://fran-portfolio.duckdns.org,http://localhost:8083
```

3. Start the application:

```bash
docker compose up -d --build
```

4. Access:
   - Public site (HTTPS): `https://fran-portfolio.duckdns.org`
   - Local HTTP fallback: `http://your-server-ip:8083`
   - Admin panel: `https://fran-portfolio.duckdns.org/admin/login`

The SQLite database is stored in `./data/` and persists across container restarts.

## Deploying to a VPS

These steps assume a Linux VPS (Ubuntu/Debian) with SSH access.

### 1. Connect to your server

```bash
ssh user@your-server-ip
```

### 2. Install Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out and back in so the docker group takes effect.

### 3. Upload the project

Option A — clone from Git (if you pushed the repo):

```bash
git clone https://github.com/your-user/portfolio-cms.git
cd portfolio-cms
```

Option B — copy files from your machine with `scp`:

```bash
scp -r C:\Users\Francesco\portfolio-cms user@your-server-ip:~/
ssh user@your-server-ip
cd portfolio-cms
```

### 4. Configure environment

```bash
cp .env.example .env
nano .env
```

Set strong values for `SECRET_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Update `CORS_ORIGINS` with your domain.

### 5. Start the application

```bash
docker compose up -d --build
```

Verify it is running:

```bash
docker compose ps
curl http://localhost:8083/api/health
```

### 6. Open firewall ports

Caddy needs 80 and 443 on the public internet so Let's Encrypt can issue the certificate. Also forward those ports on the router to this machine.

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8083/tcp
sudo ufw enable
```

The site is then available at `https://fran-portfolio.duckdns.org`. Port `8083` remains as a local HTTP fallback.

### 7. HTTPS with Caddy

Caddy is included in `docker-compose.yml`. It terminates TLS for `fran-portfolio.duckdns.org` and proxies to the frontend container.

Confirm DuckDNS points to the server's public IP, then:

```bash
# In .env, include the HTTPS origin
# CORS_ORIGINS=https://fran-portfolio.duckdns.org

docker compose down && docker compose up -d --build
docker compose logs -f caddy
```

Caddy obtains and renews the Let's Encrypt certificate automatically once ports 80 and 443 are reachable from the internet.

### 8. Updating after changes

```bash
cd ~/portfolio-cms
git pull                          # if using git
docker compose up -d --build
```

Your database in `./data/` is preserved across rebuilds.

## Reset Database

To start with a clean database (removes all projects, keeps admin user on next seed):

```bash
docker compose down
rm -f data/portfolio.db
docker compose up -d
```

Or locally:

```bash
rm -f backend/data/portfolio.db
cd backend && python -m app.seed
```

## Security Notes

- Passwords are hashed with bcrypt; never stored in plaintext
- JWT secret must be set via environment variables
- Admin endpoints require valid JWT authentication
- Public endpoints only return published projects
- SQLite database file is not exposed via HTTP
