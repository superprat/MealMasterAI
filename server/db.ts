import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

// Neon needs its WebSocket driver; any other Postgres (local, Supabase, Railway, ...) uses node-postgres
const isNeon = /\.neon\.tech|\.neon\.build/.test(connectionString);

function createDb() {
  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    return drizzleNeon({ client: new NeonPool({ connectionString }), schema });
  }
  return drizzlePg({ client: new pg.Pool({ connectionString }), schema });
}

export const db = createDb();
