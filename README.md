# Food Ordering App

This is a comprehensive full-stack application providing POS, B2C, and B2B functionalities, built with a Flask backend and React frontends (Customer & Admin).

## Architecture

*   **Backend:** Flask, SQLAlchemy, JWT Authentication, Redis (Blocklist & Rate Limiting), APScheduler (Background jobs)
*   **Customer Frontend:** React (Vite), Tailwind CSS
*   **Admin/POS Frontend:** React (Vite), Tailwind CSS

## Deployment & Production Requirements

### Environment Variables (Backend)

*   `FLASK_ENV`: Set to `production` in live environments.
*   `SECRET_KEY`: **Required in production.** Used for session signing, QR code generation, etc.
*   `JWT_SECRET_KEY`: **Required in production.** Used for JWT signature.
*   `REDIS_URL`: **Required in production.** Used for JWT token blocklisting. Example: `redis://localhost:6379/0`
*   `ALLOW_SEED`: (Optional) Set to `1` to run database seed logic in production (normally disabled).
*   `DATABASE_URL`: (Optional) Full connection string. Defaults to SQLite if not provided (except in production).
*   **MySQL Variables (Alternative to `DATABASE_URL`)**:
    *   `MYSQL_HOST`: e.g. `localhost`
    *   `MYSQL_USER`: Database username
    *   `MYSQL_PASSWORD`: Database password
    *   `MYSQL_DB`: Database name
*   **Mail Variables**:
    *   `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER`, `ADMIN_EMAIL`

### Redis Requirement

**Redis is strictly required in production (`FLASK_ENV=production`).** If `REDIS_URL` is missing or the Redis instance cannot be pinged on startup, the application will refuse to start and will throw a `RuntimeError`.

To run Redis locally via Docker:
```bash
docker run --name my-redis -p 6379:6379 -d redis
```

### Authentication & JWT Lifecycle

*   **Access Token**: Expires in 15 minutes.
*   **Refresh Token**: Expires in 7 days.
*   **Endpoints**:
    *   `POST /api/auth/login`: Returns `access_token` + `refresh_token`.
    *   `POST /api/auth/refresh`: Accepts `Authorization: Bearer <refresh_token>` and returns a new `access_token` and `refresh_token`.
    *   `POST /api/auth/logout`: Accepts `Authorization: Bearer <access_token>` and body `{"refresh_token": "<token>"}` to revoke tokens using the Redis blocklist.

### Database Migration

If you are updating an existing database to the latest schema, you must run this migration to add the JWT token version field:
```sql
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
```

## Security & Privacy Notes

*   **Ticket Attachments**: Ticket attachment URLs are located under `/static/uploads/tickets/`. Currently, these URLs are unguessable due to timestamp prefixing. A recommended follow-up is to serve these files through an authenticated `GET /api/customer/tickets/<id>/attachment` route.
*   **Token Caching**: For improved performance at scale, it is recommended to cache `user.token_version` in Redis using a short TTL and invalidate it upon password change.

## Running Tests

To run the backend test suite, navigate to the `backend` directory and use pytest:
```bash
cd backend
REDIS_URL=memory:// python -m pytest tests/ -v --tb=short
```
