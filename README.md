# Cheapkart frontend

React + Vite storefront. For local development, set `VITE_API_URL` in `.env` (defaults in `.env.example`) and run `npm run dev`.

## Docker

Build the static Nginx image with the public API URL that browsers should call:

```sh
docker build --build-arg VITE_API_URL=https://api.example.com -t cheapkart-frontend:local .
docker run --rm -p 8080:80 cheapkart-frontend:local
```

Open `http://localhost:8080`. The API URL is compiled into the Vite bundle at image build time. It is public client configuration, not a secret; never put database, AWS, JWT, or Solace credentials in frontend environment variables. Build a new image when the API URL changes. Nginx serves the SPA and falls back to `index.html` for client routes.

The Docker build excludes `.env` files, `node_modules`, and local build output.
