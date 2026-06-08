# NIT Inventory Server Deployment Guide

This document outlines the step-by-step instructions to deploy and run **NIT Inventory** seamlessly on a production server using Docker Compose.

---

## 1. Prerequisites

Ensure the following dependencies are installed on the target server:
1. **Docker**: (v20.10 or higher)
2. **Docker Compose**: (v2.0 or higher)
3. **Nginx** (or any reverse proxy) to manage SSL certificates.

---

## 2. Directory Structure on Server

Clone or copy the project to your deployment directory (e.g., `/var/www/nitinventory`). The folder structure must look like this:

```text
nitinventory/
├── backend/
│   ├── app/
│   ├── storage/             # Created automatically, stores signatures and PDFs
│   ├── .env                 # Production environment settings (configured below)
│   ├── Dockerfile
│   └── seed.py
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── vite.config.ts
├── docker-compose.yml       # Orchestrates the database, backend, and frontend
└── hod_admin.csv            # Contains the HOD/Admin credentials to be seeded
```

---

## 3. Configuration Setup

### Create the Production Environment File
Copy/create the file `backend/.env` on the server. Update the settings for production:

```ini
# Database URL (FastAPI connects to the 'db' container within the Docker network)
DATABASE_URL=postgresql+asyncpg://nitinventory:nitinventory_secret@db:5432/nitinventory

# Cryptographically secure key (Change this for your deployment)
SECRET_KEY=5fc7afc22ec908c9f568531c56aee7120ff53527650e6318078866360ecdff6e

# Token expiration duration
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Storage Path within the container
STORAGE_PATH=/app/storage

# Production details
FRONTEND_URL=https://inventory.nitt.edu
ENVIRONMENT=production

# SMTP configuration for notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@nitt.edu
SMTP_PASSWORD=your-app-password
```

> [!WARNING]
> Ensure **`ENVIRONMENT=production`** is set. This enables secure HTTP cookie flags, protecting JWT session tokens from browser-side interception.

---

## 4. Run the Application

To build the images and run the services in the background:

```bash
# From the root directory:
docker compose up -d --build
```

### What happens automatically on startup:
1. **Database Container Initialization:** Runs Postgres 16 and sets up the schema.
2. **Automatic Migrations:** The backend container runs `seed.py` on startup, which automatically creates the tables and executes `ALTER TABLE` migrations to add new fields (like `remarks`, `is_verified`, etc.) dynamically if they do not exist.
3. **Dynamic User Seeding:** The backend parses `hod_admin.csv` and seeds the default administrator (`admin@nitt.edu`) and department HOD accounts securely.
4. **Vite Proxy Serving:** Serves the frontend container on port `5173`.

---

## 5. Verify the Containers

Check the status of your containers to make sure they are healthy:

```bash
docker compose ps
```

You should see three running containers:
- `nitinventory-frontend` (Port `5173`)
- `nitinventory-backend` (Port `8000`)
- `nitinventory-db` (Port `5432`)

---

## 6. Configure Nginx Reverse Proxy & SSL

Configure Nginx to proxy standard HTTPS requests on ports 80/443 directly to the Vite frontend container (Port `5173`). Vite will internally handle reverse-proxying `/api` and `/storage` requests to the FastAPI backend.

Add this server block configuration to Nginx (usually in `/etc/nginx/sites-available/nitinventory`):

```nginx
server {
    listen 80;
    server_name inventory.nitt.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name inventory.nitt.edu;

    ssl_certificate /etc/letsencrypt/live/inventory.nitt.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inventory.nitt.edu/privkey.pem;

    # Set appropriate client upload sizes for signature & CSV uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/nitinventory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. Backups (Recommended)

To back up your PostgreSQL database container at any time:
```bash
docker exec -t nitinventory-db pg_dump -U nitinventory nitinventory > db_backup_$(date +%F).sql
```
To back up the user-uploaded signatures and document PDFs, simply copy the `./backend/storage` directory.

---

## 8. Future Procurement Re-enablement

If you decide to bring the legacy Purchase Request and Procurement features live in the future, follow these steps to restore user access (no database migrations or backend changes are needed as the database models and APIs are fully preserved):

### Step A: Restore Navigation Menu Items
In [DashboardLayout.tsx](file:///Users/jaiyandh/Projects/nitinventory/frontend/src/layouts/DashboardLayout.tsx), locate the sidebar filtering logic (around lines 41–48):
```typescript
  const visibleItems = NAV_ITEMS.filter(
    (item) => {
      if (item.isProcurement && user?.role?.group_key !== 'admin') {
        return false;
      }
      return !item.roles || (user?.role && item.roles.includes(user.role.group_key));
    }
  );
```
Remove the `isProcurement` check so that links are filtered solely based on user roles:
```typescript
  const visibleItems = NAV_ITEMS.filter(
    (item) => {
      return !item.roles || (user?.role && item.roles.includes(user.role.group_key));
    }
  );
```

### Step B: Unblock Protected Client Routes
In [App.tsx](file:///Users/jaiyandh/Projects/nitinventory/frontend/src/App.tsx), locate the route security checker (around line 34):
```typescript
  if (isProcurement && user.role?.group_key !== 'admin') return <Navigate to="/dashboard" replace />;
```
Delete or comment out this line so that role-scoped users (like HODs and Faculty) can access `/pr`, `/budget`, `/inventory/deliveries`, etc.

