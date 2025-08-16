# Deployment Guide (Fly.io)

This guide will walk you through deploying the application to [Fly.io](https://fly.io).

## Prerequisites

1.  **A Fly.io Account:** If you don't have one, sign up at [fly.io](https://fly.io).
2.  **`flyctl`:** The Fly.io command-line tool. You can install it by following the instructions [here](https://fly.io/docs/hands-on/install-flyctl/).

## Deployment Steps

### 1. Login to Fly.io

Open your terminal and run:
```bash
fly auth login
```
This will open a browser window for you to log in.

### 2. Launch the App

Navigate to the project's root directory in your terminal and run:
```bash
fly launch
```
This command will detect the `fly.toml` file and configure your application.
-   It will ask you to choose an organization. Select your personal organization.
-   It will ask for an app name. It will default to `vip-auto-logbook` from `fly.toml`. You can keep this or change it.
-   It will ask you to choose a region. You can choose one close to you.
-   **Important:** When it asks if you want to set up a Postgres database now, choose **No**. We will do this manually in the next step.
-   When it asks if you want to deploy now, choose **No**.

### 3. Create a PostgreSQL Database

Now, let's create a database for our application:
```bash
fly postgres create
```
-   Follow the prompts to choose a name and a region for your database. It's a good idea to choose the same region as your application.
-   Choose a small plan that fits within the free tier (e.g., "Development - 256MB").
-   After the database is created, it will give you a connection string. **This is your `DATABASE_URL`**. Copy it and save it somewhere safe.

### 4. Set Secrets

Your application needs two secret environment variables to run: `DATABASE_URL` and `JWT_SECRET`.

Run the following commands, replacing `<your-database-url>` with the connection string from the previous step:
```bash
fly secrets set DATABASE_URL="<your-database-url>"
```
Now, set a secret for your JWT. This can be any long, random string.
```bash
fly secrets set JWT_SECRET="$(openssl rand -base64 32)"
```

### 5. Deploy the Application

Now you are ready to deploy your application:
```bash
fly deploy
```
This command will build the Docker image, push it to Fly.io's registry, and deploy it.

### 6. Seed the Database (Optional)

If you want to populate your database with the initial test data, you can run the `seed.js` script.
First, connect to your app's console:
```bash
fly ssh console
```
Once you are connected, run the seed script:
```bash
node seed.js
```
You should see messages indicating that the database has been seeded. Type `exit` to close the SSH session.

### 7. Visit Your App

Your application is now deployed! You can open it by running:
```bash
fly open
```
Congratulations! Your application is live.
