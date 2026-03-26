/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    TRIPS: KVNamespace;
    ADMIN_API_TOKEN: string;
    COOKIE_SIGNING_SECRET: string;
  }
}
