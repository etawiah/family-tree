# Database Setup Guide (Cloudflare D1)

This guide explains how to create the database and apply the schema used by the Family Tree App.

## 1. Create a D1 database
1. Log in to the Cloudflare dashboard.
2. Select **Workers & Pages** from the left navigation.
3. Click **D1** in the sidebar.
4. Choose **Create database**.
5. Name it something like `family-tree-db`, then confirm.

## 2. Bind the database to your Worker
1. Go to your Worker project in Cloudflare.
2. Open **Settings** → **Variables**.
3. Under **D1 Database Bindings**, add a binding named `DB`.
4. Select the database you created in step 1.

## 3. Run the schema script
You can apply the schema using the Cloudflare CLI:
```bash
npx wrangler d1 execute family-tree-db --file=./schema/init.sql
```

## 4. View database contents (debugging)
To inspect tables and rows, use the Cloudflare CLI:
```bash
npx wrangler d1 execute family-tree-db --command="SELECT * FROM people LIMIT 5;"
```

You can also view data in the Cloudflare dashboard:
1. Open the D1 database.
2. Use the **Query** tab to run SQL and view results.
