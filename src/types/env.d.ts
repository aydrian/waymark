/// <reference types="@cloudflare/workers-types" />

type Env = {
  TRIPS: KVNamespace;
  ADMIN_API_TOKEN: string;
  COOKIE_SIGNING_SECRET: string;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
