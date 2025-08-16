# Deployment Guide (Render.com)

This guide will walk you through deploying the application to [Render](https://render.com), a cloud platform with a great free tier that does not require a credit card.

Thanks to the `render.yaml` file in this repository, the entire setup process is automated.

## Deployment Steps

### 1. Create a Render Account

If you don't have one, sign up at [dashboard.render.com](https://dashboard.render.com/). You can sign up using your GitHub account, which will make the next steps easier.

### 2. Create a New Blueprint Instance

A "Blueprint" on Render is a set of services defined in a `render.yaml` file.

1.  Go to the **Blueprints** page in your Render dashboard.
2.  Click the **New Blueprint Instance** button.
3.  Connect your GitHub account if you haven't already, and select this repository.
4.  Render will automatically detect and parse the `render.yaml` file. It will show you the two services to be created:
    *   `vip-auto-db` (PostgreSQL Database)
    *   `vip-auto-app` (Web Service)
5.  Give your Blueprint a name (e.g., "VIP Auto Logbook").
6.  Click **Apply**.

That's it! Render will now build and deploy your application and its database.

### 3. The First Deployment

The first deployment might take a few minutes as Render needs to:
-   Provision the PostgreSQL database.
-   Install your Node.js dependencies (`npm install`).
-   Start your web service (`node server.js`).

You can watch the deployment progress in the logs on your Render dashboard. Once the deployment is complete, your application will be live.

### 4. Your Application URL

You can find the URL for your live application on the service page for `vip-auto-app` in your Render dashboard. The URL will look something like `https://vip-auto-app.onrender.com`.

### 5. Seeding the Database (Optional)

Your application is running, but the database is empty. If you want to add the initial test data, you can run the `seed.js` script.

1.  In your Render dashboard, go to the page for your `vip-auto-app` service.
2.  Click on the **Shell** tab.
3.  In the shell, type the following command and press Enter:
    ```bash
    node seed.js
    ```
4.  The script will run and print messages indicating that it is seeding the database.

Now your application is deployed and populated with test data. Enjoy!
