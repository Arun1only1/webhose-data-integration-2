# Webhose Data Integration Service

This is a NestJS-based service for integrating with the Webz.io API (formerly Webhose.io) to fetch and process web content. The service is designed to work seamlessly with PostgreSQL as a database and Docker for deployment.

---

## Features

- **Fetch Content**: Integrates with Webz.io API to fetch web content, including news and articles.
- **PostgreSQL Integration**: Stores and manages data fetched from the API in a PostgreSQL database.
- **Dockerized**: Easy to deploy using Docker and Docker Compose.
- **Environment Configurable**: Supports `.env` files for easy environment configuration.
- **REST API**: Exposes endpoints to interact with the service.

---

## Prerequisites

- **Docker**: Installed and running

---

## Environment Variables

Set up your environment variables in a `.env` file:

```plaintext
# Application Configuration
NODE_ENV=dev
API_PORT=8080
SYSTEM_LANGUAGE=EN

# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USERNAME
DB_PASSWORD
DB_NAME

# Webz.io API Configuration
WEBZ_IO_API_KEY
WEBZ_NEWS_URL='https://api.webz.io'

# Pg admin configuration
PGADMIN_DEFAULT_EMAIL
PGADMIN_DEFAULT_PASSWORD
```

---

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/your-username/webhose-data-integration-service.git
   cd webhose-data-integration-service
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set Up Environment**:
   Create a `.env` file in the root directory and configure the environment variables.

4. **Run the Application Locally**:
   ```bash
   npm run start:dev
   ```

---

## Using Docker

1. **Build and Start the Services**:

   ```bash
   docker compose up --build
   ```

2. **Access the Application**:
   - The API will be available at [http://localhost:8080](http://localhost:8080).
   - PostgreSQL will be running on port `5432`.

---

## Resources

- **Webz.io API Documentation**: [https://webz.io](https://webz.io)
- **NestJS Documentation**: [https://docs.nestjs.com](https://docs.nestjs.com)
- **Docker Documentation**: [https://docs.docker.com](https://docs.docker.com)
