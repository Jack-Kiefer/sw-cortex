/**
 * Database Service - Query external databases with SSH tunnel support
 * Provides read-only access to WishDesk, SugarWish, Odoo, Retool
 */

import mysql from 'mysql2/promise';
import pg from 'pg';
import { Client as SSHClient } from 'ssh2';
import { readFileSync } from 'fs';
import { createServer, Server as NetServer, AddressInfo } from 'net';

// pg defaults parse oid 1114 (timestamp without time zone) into a JS Date by
// interpreting the naive string as the process's local timezone. JSON.stringify
// then calls toISOString() which shifts to UTC and appends "Z" — so a row
// stored as naive UTC in Odoo gets returned as a value 4h ahead of the truth
// when this MCP runs in EDT. Return the raw string so consumers see exactly
// what Postgres stored. oid 1184 (timestamptz) keeps the default behavior
// since those values are unambiguously tied to a zone.
pg.types.setTypeParser(1114, (v) => v);

// Database configuration with optional SSH tunnel
export interface DatabaseConfig {
  name: string;
  type: 'mysql' | 'postgres';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  // SSH tunnel config (optional - if present, will try tunnel first then fallback to direct)
  ssh?: {
    host: string;
    port: number;
    user: string;
    privateKeyPath: string;
  };
}

// Track which databases fell back to direct connection
const directConnectionFallbacks: Set<string> = new Set();

// Active tunnel tracking
interface TunnelInfo {
  server: NetServer;
  sshClient: SSHClient;
  localPort: number;
}

const activeTunnels: Map<string, TunnelInfo> = new Map();

// Get database configs from environment
export function getDatabaseConfigs(): Record<string, DatabaseConfig> {
  // SSH config for live databases (sugarwish)
  const liveSshConfig = process.env.LIVE_SSH_HOST
    ? {
        host: process.env.LIVE_SSH_HOST,
        port: parseInt(process.env.LIVE_SSH_PORT || '22', 10),
        user: process.env.LIVE_SSH_USER || '',
        privateKeyPath: process.env.LIVE_SSH_KEY_PATH || '~/.ssh/id_rsa',
      }
    : undefined;

  // General SSH config (fallback)
  const sshConfig = process.env.SSH_BASTION_HOST
    ? {
        host: process.env.SSH_BASTION_HOST,
        port: parseInt(process.env.SSH_BASTION_PORT || '22', 10),
        user: process.env.SSH_BASTION_USER || '',
        privateKeyPath: process.env.SSH_KEY_PATH || '~/.ssh/id_rsa',
      }
    : undefined;

  // SSH is now included when config exists - will try tunnel first, fallback to direct
  // Set *_USE_SSH=false to explicitly disable tunnel attempts for a database
  return {
    wishdesk: {
      name: 'wishdesk',
      type: 'mysql',
      host: process.env.WISHDESK_DB_HOST || 'localhost',
      port: parseInt(process.env.WISHDESK_DB_PORT || '3306', 10),
      user: process.env.WISHDESK_DB_USER || '',
      password: process.env.WISHDESK_DB_PASSWORD || '',
      database: process.env.WISHDESK_DB_NAME || '',
      ssh: process.env.WISHDESK_USE_SSH !== 'false' ? liveSshConfig : undefined,
    },
    wishdesk_dev: {
      name: 'wishdesk_dev',
      type: 'mysql',
      host: process.env.WISHDESK_DEV_DB_HOST || 'localhost',
      port: parseInt(process.env.WISHDESK_DEV_DB_PORT || '3306', 10),
      user: process.env.WISHDESK_DEV_DB_USER || '',
      password: process.env.WISHDESK_DEV_DB_PASSWORD || '',
      database: process.env.WISHDESK_DEV_DB_NAME || '',
      // Direct connection to dev host
    },
    laravel_live: {
      name: 'laravel_live',
      type: 'mysql',
      host: process.env.SUGARWISH_DB_HOST || 'localhost',
      port: parseInt(process.env.SUGARWISH_DB_PORT || '3306', 10),
      user: process.env.SUGARWISH_DB_USER || '',
      password: process.env.SUGARWISH_DB_PASSWORD || '',
      database: process.env.SUGARWISH_DB_NAME || '',
      ssh: process.env.LIVE_SSH_TUNNEL !== 'false' ? liveSshConfig : undefined,
    },
    odoo: {
      name: 'odoo',
      type: 'postgres',
      host: process.env.ODOO_DB_HOST || 'localhost',
      port: parseInt(process.env.ODOO_DB_PORT || '5432', 10),
      user: process.env.ODOO_DB_USER || '',
      password: process.env.ODOO_DB_PASSWORD || '',
      database: process.env.ODOO_DB_NAME || '',
      ssh: process.env.ODOO_USE_SSH !== 'false' ? sshConfig : undefined,
    },
    retool: {
      name: 'retool',
      type: 'postgres',
      host: process.env.RETOOL_DB_HOST || 'localhost',
      port: parseInt(process.env.RETOOL_DB_PORT || '5432', 10),
      user: process.env.RETOOL_DB_USER || '',
      password: process.env.RETOOL_DB_PASSWORD || '',
      database: process.env.RETOOL_DB_NAME || '',
      ssh: process.env.RETOOL_USE_SSH !== 'false' ? sshConfig : undefined,
    },
    odoo_staging: {
      name: 'odoo_staging',
      type: 'postgres',
      host: process.env.ODOO_STAGING_DB_HOST || 'localhost',
      port: parseInt(process.env.ODOO_STAGING_DB_PORT || '5432', 10),
      user: process.env.ODOO_STAGING_DB_USER || '',
      password: process.env.ODOO_STAGING_DB_PASSWORD || '',
      database: process.env.ODOO_STAGING_DB_NAME || '',
      ssh: process.env.ODOO_STAGING_USE_SSH !== 'false' ? sshConfig : undefined,
    },
    local: {
      name: 'local',
      type: 'mysql',
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '3307', 10),
      user: process.env.LOCAL_DB_USER || 'root',
      password: process.env.LOCAL_DB_PASSWORD || '',
      // User picks the actual MySQL database name (e.g. serp_local, my_laravel_dev)
      database: process.env.LOCAL_DB_NAME || '',
      // No SSH for local database
    },
    // SERP local DBs — four side-by-side schemas on the same local Docker MySQL
    // as `local`, plus serp_test for pytest. Connection params are shared with
    // `local`; only the database name differs. See SERP/CLAUDE.md for the
    // semantics of each schema.
    serp_staging_replica: {
      name: 'serp_staging_replica',
      type: 'mysql',
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '3307', 10),
      user: process.env.LOCAL_DB_USER || 'root',
      password: process.env.LOCAL_DB_PASSWORD || '',
      database: 'serp_staging_replica',
    },
    serp_prod_replica: {
      name: 'serp_prod_replica',
      type: 'mysql',
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '3307', 10),
      user: process.env.LOCAL_DB_USER || 'root',
      password: process.env.LOCAL_DB_PASSWORD || '',
      database: 'serp_prod_replica',
    },
    serp_staging_darklaunch: {
      name: 'serp_staging_darklaunch',
      type: 'mysql',
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '3307', 10),
      user: process.env.LOCAL_DB_USER || 'root',
      password: process.env.LOCAL_DB_PASSWORD || '',
      database: 'serp_staging_darklaunch',
    },
    serp_prod_darklaunch: {
      name: 'serp_prod_darklaunch',
      type: 'mysql',
      host: process.env.LOCAL_DB_HOST || '127.0.0.1',
      port: parseInt(process.env.LOCAL_DB_PORT || '3307', 10),
      user: process.env.LOCAL_DB_USER || 'root',
      password: process.env.LOCAL_DB_PASSWORD || '',
      database: 'serp_prod_darklaunch',
    },
    // Live darklaunch DB on Hetzner (the future production DB; mirror of the
    // local darklaunch schemas). Connects directly — no SSH tunnel.
    live_darklaunch_db: {
      name: 'live_darklaunch_db',
      type: 'mysql',
      host: process.env.LIVE_DARKLAUNCH_DB_HOST || '',
      port: parseInt(process.env.LIVE_DARKLAUNCH_DB_PORT || '3306', 10),
      user: process.env.LIVE_DARKLAUNCH_DB_USER || '',
      password: process.env.LIVE_DARKLAUNCH_DB_PASSWORD || '',
      database: process.env.LIVE_DARKLAUNCH_DB_NAME || 'serp_test',
    },
    manage: {
      name: 'manage',
      type: 'mysql',
      host: process.env.MANAGE_DB_HOST || 'localhost',
      port: parseInt(process.env.MANAGE_DB_PORT || '3306', 10),
      user: process.env.MANAGE_DB_USER || '',
      password: process.env.MANAGE_DB_PASSWORD || '',
      database: process.env.MANAGE_DB_NAME || '',
      // No SSH - direct connection to RDS
    },
  };
}

// Create SSH tunnel and return local port
async function createTunnel(config: DatabaseConfig): Promise<number> {
  if (!config.ssh) {
    throw new Error('SSH config required for tunnel');
  }

  const tunnelKey = config.name;

  // Return existing tunnel if active
  if (activeTunnels.has(tunnelKey)) {
    return activeTunnels.get(tunnelKey)!.localPort;
  }

  return new Promise((resolve, reject) => {
    const sshClient = new SSHClient();

    // Read private key
    let privateKey: string;
    try {
      const keyPath = config.ssh!.privateKeyPath.replace('~', process.env.HOME || '');
      privateKey = readFileSync(keyPath, 'utf8');
    } catch {
      reject(new Error(`Failed to read SSH key: ${config.ssh!.privateKeyPath}`));
      return;
    }

    // Create local server to forward connections
    const server = createServer((socket) => {
      sshClient.forwardOut('127.0.0.1', 0, config.host, config.port, (err, stream) => {
        if (err) {
          socket.end();
          return;
        }
        socket.pipe(stream).pipe(socket);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const localPort = (server.address() as AddressInfo).port;

      sshClient.on('ready', () => {
        activeTunnels.set(tunnelKey, { server, sshClient, localPort });
        resolve(localPort);
      });

      sshClient.on('error', (err) => {
        server.close();
        activeTunnels.delete(tunnelKey);
        mysqlPools.delete(tunnelKey);
        pgPools.delete(tunnelKey);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      // Clean up when tunnel dies so next query creates a fresh one
      sshClient.on('close', () => {
        server.close();
        activeTunnels.delete(tunnelKey);
        mysqlPools.delete(tunnelKey);
        pgPools.delete(tunnelKey);
      });

      sshClient.on('end', () => {
        server.close();
        activeTunnels.delete(tunnelKey);
        mysqlPools.delete(tunnelKey);
        pgPools.delete(tunnelKey);
      });

      sshClient.connect({
        host: config.ssh!.host,
        port: config.ssh!.port,
        username: config.ssh!.user,
        privateKey,
      });
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to create tunnel server: ${err.message}`));
    });
  });
}

// Get effective connection details (try tunnel first, fallback to direct)
async function getConnectionDetails(
  config: DatabaseConfig
): Promise<{ host: string; port: number; viaTunnel: boolean }> {
  // If already fell back to direct for this database, use direct
  if (directConnectionFallbacks.has(config.name)) {
    return { host: config.host, port: config.port, viaTunnel: false };
  }

  // Try SSH tunnel first if config exists
  if (config.ssh) {
    try {
      const localPort = await createTunnel(config);
      console.log(`[db] ${config.name}: connected via SSH tunnel (port ${localPort})`);
      return { host: '127.0.0.1', port: localPort, viaTunnel: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(
        `[db] ${config.name}: SSH tunnel failed (${errorMsg}), falling back to direct connection`
      );
      directConnectionFallbacks.add(config.name);
      // Fall through to direct connection
    }
  }

  // Direct connection
  console.log(`[db] ${config.name}: using direct connection to ${config.host}:${config.port}`);
  return { host: config.host, port: config.port, viaTunnel: false };
}

// Connection pools
const mysqlPools: Map<string, mysql.Pool> = new Map();
const pgPools: Map<string, pg.Pool> = new Map();

// Get or create MySQL connection pool
async function getMySQLPool(config: DatabaseConfig): Promise<mysql.Pool> {
  const key = config.name;

  if (!mysqlPools.has(key)) {
    const { host, port } = await getConnectionDetails(config);

    const pool = mysql.createPool({
      host,
      port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
    // Server-side query abort for every shape (plain SELECT, CTE, UNION, …):
    // set the session max_execution_time on each new physical connection so
    // MySQL itself kills any statement still running after 30s. SELECT-only at
    // the engine level — harmless for the read-only queries this server runs.
    pool.on('connection', (conn) => {
      conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
    });
    mysqlPools.set(key, pool);
  }
  return mysqlPools.get(key)!;
}

// Get or create PostgreSQL connection pool
async function getPGPool(config: DatabaseConfig): Promise<pg.Pool> {
  const key = config.name;

  if (!pgPools.has(key)) {
    const { host, port } = await getConnectionDetails(config);

    const pool = new pg.Pool({
      host,
      port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 5,
      // Enable SSL for remote PostgreSQL connections (required by Odoo, Retool)
      ssl: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    });
    // Server-side query abort: Postgres cancels any statement still running
    // after 30s, so a slow query can't keep grinding on a shared box. Set on
    // each new connection rather than via the `options` startup parameter,
    // which the poolers in front of Odoo/Retool reject.
    pool.on('connect', (client) => {
      client.query(`SET statement_timeout = ${QUERY_TIMEOUT_MS}`).catch(() => {});
    });
    pgPools.set(key, pool);
  }
  return pgPools.get(key)!;
}

// Validate query is read-only
function validateReadOnly(query: string): void {
  const normalized = query.trim().toUpperCase();
  const forbidden = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'TRUNCATE',
    'ALTER',
    'CREATE',
    'GRANT',
    'REVOKE',
  ];

  for (const keyword of forbidden) {
    if (normalized.startsWith(keyword)) {
      throw new Error(`Write operations not allowed. Query starts with: ${keyword}`);
    }
  }
}

// Hard 30s cap on any query. Two layers enforce it:
//   1. The DB engine aborts the query itself (MySQL session max_execution_time,
//      Postgres statement_timeout, both set per-connection in the pool getters)
//      — this is what stops a slow query from grinding on a shared box after
//      we've stopped waiting.
//   2. A JS wall-clock guard (withTimeout below) also covers connect / SSH
//      tunnel hangs, which the engine-level timeouts can't see.
const QUERY_TIMEOUT_MS = 30_000;

// Reject if a promise hasn't settled within QUERY_TIMEOUT_MS.
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Query exceeded ${QUERY_TIMEOUT_MS / 1000}s timeout`)),
      QUERY_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// Query result type
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

// Execute query against a database
export async function queryDatabase(
  databaseName: string,
  query: string,
  limit?: number
): Promise<QueryResult> {
  const configs = getDatabaseConfigs();
  const config = configs[databaseName.toLowerCase()];

  if (!config) {
    throw new Error(
      `Unknown database: ${databaseName}. Available: ${Object.keys(configs).join(', ')}`
    );
  }

  // Enforce read-only
  validateReadOnly(query);

  // Add LIMIT if not present and limit specified
  let finalQuery = query.trim();
  if (limit && !finalQuery.toUpperCase().includes('LIMIT')) {
    finalQuery = `${finalQuery} LIMIT ${limit}`;
  }

  if (config.type === 'mysql') {
    const pool = await getMySQLPool(config);
    // Engine-level abort comes from SESSION max_execution_time (set on each
    // connection in getMySQLPool); withTimeout adds the wall-clock guard that
    // also covers connect / SSH tunnel hangs.
    const [rows, fields] = await withTimeout(pool.query(finalQuery));
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    return {
      columns: fields ? (fields as mysql.FieldPacket[]).map((f) => f.name) : [],
      rows: rowsArray as Record<string, unknown>[],
      rowCount: rowsArray.length,
    };
  } else {
    const pool = await getPGPool(config);
    const result = await withTimeout(pool.query(finalQuery));
    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }
}

// List tables in a database
export async function listTables(databaseName: string): Promise<string[]> {
  const configs = getDatabaseConfigs();
  const config = configs[databaseName.toLowerCase()];

  if (!config) {
    throw new Error(
      `Unknown database: ${databaseName}. Available: ${Object.keys(configs).join(', ')}`
    );
  }

  if (config.type === 'mysql') {
    const result = await queryDatabase(databaseName, 'SHOW TABLES');
    return result.rows.map((row) => Object.values(row)[0] as string);
  } else {
    const result = await queryDatabase(
      databaseName,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return result.rows.map((row) => row.tablename as string);
  }
}

// Describe a table's structure
export async function describeTable(
  databaseName: string,
  tableName: string
): Promise<Array<{ column: string; type: string; nullable: boolean }>> {
  const configs = getDatabaseConfigs();
  const config = configs[databaseName.toLowerCase()];

  if (!config) {
    throw new Error(
      `Unknown database: ${databaseName}. Available: ${Object.keys(configs).join(', ')}`
    );
  }

  if (config.type === 'mysql') {
    const result = await queryDatabase(databaseName, `DESCRIBE \`${tableName}\``);
    return result.rows.map((row: Record<string, unknown>) => ({
      column: row.Field as string,
      type: row.Type as string,
      nullable: row.Null === 'YES',
    }));
  } else {
    const result = await queryDatabase(
      databaseName,
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = '${tableName}' AND table_schema = 'public'
       ORDER BY ordinal_position`
    );
    return result.rows.map((row) => ({
      column: row.column_name as string,
      type: row.data_type as string,
      nullable: row.is_nullable === 'YES',
    }));
  }
}

// List available databases
export function listDatabases(): string[] {
  return Object.keys(getDatabaseConfigs());
}

// Close all connection pools and tunnels
export async function closeAllPools(): Promise<void> {
  // Close database pools
  for (const pool of mysqlPools.values()) {
    await pool.end();
  }
  for (const pool of pgPools.values()) {
    await pool.end();
  }
  mysqlPools.clear();
  pgPools.clear();

  // Close SSH tunnels
  for (const tunnel of activeTunnels.values()) {
    tunnel.server.close();
    tunnel.sshClient.end();
  }
  activeTunnels.clear();
}
