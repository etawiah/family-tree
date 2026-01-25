/**
 * Cloudflare Worker entry point.
 *
 * A Worker is a lightweight, serverless function that runs at Cloudflare's edge.
 * It receives HTTP requests and returns HTTP responses without a traditional server.
 *
 * This template focuses on wiring up the D1 database binding so future API routes
 * can query and mutate data. The `env` parameter contains bindings configured in
 * Cloudflare (like databases, KV, or secrets).
 */
export default {
  /**
   * Handle all incoming HTTP requests.
   *
   * @param {Request} request - Standard Fetch API Request object.
   * @param {Record<string, unknown>} env - Environment bindings injected by Cloudflare.
   * @param {ExecutionContext} ctx - Worker execution context for background tasks.
   * @returns {Promise<Response>} A Fetch API Response.
   */
  async fetch(request, env, ctx) {
    // D1 database binding. In Cloudflare, you'll bind the D1 database as "DB".
    // This gives you access to env.DB for running SQL queries.
    const db = env.DB;

    // Minimal health response while the API is scaffolded.
    const payload = {
      message: "Family Tree API is running.",
      hasDatabaseBinding: Boolean(db),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};
