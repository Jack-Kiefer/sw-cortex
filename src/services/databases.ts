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
  // SSH tunnel config. When present, the connection is forwarded through the
  // bastion. All databases that share the same bastion reuse ONE tunnel — see
  // SshTunnelConfig / createTunnel below.
  ssh?: SshTunnelConfig;
}

// One shared SSH tunnel definition. Every database pointing at the same bastion
// (same host/port/user/key) shares a single SSH connection and a single local
// forward port, keyed by `tunnelKey`.
interface SshTunnelConfig {
  host: string;
  port: number;
  user: string;
  privateKeyPath: string;
  // Stable key identifying the tunnel so multiple DBs collapse onto one SSH
  // connection instead of opening one per database.
  tunnelKey: string;
  // Preferred fixed local port to bind (e.g. 13306 so /start-day can probe it).
  // Falls back to an ephemeral port when unset or already in use.
  preferredLocalPort?: number;
}

// Active tunnel tracking, keyed by SshTunnelConfig.tunnelKey (NOT by database),
// so wishdesk and laravel_live share the same bastion connection.
interface TunnelInfo {
  server: NetServer;
  sshClient: SSHClient;
  localPort: number;
  // In-flight connect promise: concurrent first-queries await the same connect
  // instead of racing to open duplicate tunnels.
  ready: Promise<number>;
}

const activeTunnels: Map<string, TunnelInfo> = new Map();

// Get database configs from environment
export function getDatabaseConfigs(): Record<string, DatabaseConfig> {
  // The ONE SSH bastion this service uses. Only the two databases that live on
  // the private AWS RDS (wishdesk, laravel_live) route through it; every other
  // remote DB (Odoo/Retool cloud, Hetzner hosts) is publicly reachable and
  // connects directly. LIVE_SSH_TUNNEL=false disables the tunnel entirely.
  const liveSshConfig: SshTunnelConfig | undefined =
    process.env.LIVE_SSH_HOST && process.env.LIVE_SSH_TUNNEL !== 'false'
      ? {
          host: process.env.LIVE_SSH_HOST,
          // Accept LIVE_SSH_PORT; the bastion SSH port is 22 by default.
          port: parseInt(process.env.LIVE_SSH_PORT || '22', 10),
          user: process.env.LIVE_SSH_USER || '',
          privateKeyPath: process.env.LIVE_SSH_KEY_PATH || '~/.ssh/id_rsa',
          tunnelKey: 'live-bastion',
          // Bind the fixed port /start-day probes (LIVE_SSH_TUNNEL_PORT, e.g.
          // 13306) when set, so the health check and the app agree on the port.
          preferredLocalPort: process.env.LIVE_SSH_TUNNEL_PORT
            ? parseInt(process.env.LIVE_SSH_TUNNEL_PORT, 10)
            : undefined,
        }
      : undefined;

  return {
    wishdesk: {
      name: 'wishdesk',
      type: 'mysql',
      host: process.env.WISHDESK_DB_HOST || 'localhost',
      port: parseInt(process.env.WISHDESK_DB_PORT || '3306', 10),
      user: process.env.WISHDESK_DB_USER || '',
      password: process.env.WISHDESK_DB_PASSWORD || '',
      database: process.env.WISHDESK_DB_NAME || '',
      // Routes through the live bastion (private RDS). WISHDESK_USE_SSH is a
      // deprecated per-DB alias kept working; LIVE_SSH_TUNNEL is the real toggle
      // (already applied when building liveSshConfig).
      ssh: process.env.WISHDESK_USE_SSH === 'false' ? undefined : liveSshConfig,
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
      // Same private RDS as wishdesk → same shared bastion tunnel.
      ssh: liveSshConfig,
    },
    odoo: {
      name: 'odoo',
      type: 'postgres',
      host: process.env.ODOO_DB_HOST || 'localhost',
      port: parseInt(process.env.ODOO_DB_PORT || '5432', 10),
      user: process.env.ODOO_DB_USER || '',
      password: process.env.ODOO_DB_PASSWORD || '',
      database: process.env.ODOO_DB_NAME || '',
      // Public Odoo Cloud host over SSL — direct connection, no bastion.
    },
    retool: {
      name: 'retool',
      type: 'postgres',
      host: process.env.RETOOL_DB_HOST || 'localhost',
      port: parseInt(process.env.RETOOL_DB_PORT || '5432', 10),
      user: process.env.RETOOL_DB_USER || '',
      password: process.env.RETOOL_DB_PASSWORD || '',
      database: process.env.RETOOL_DB_NAME || '',
      // Public Retool Cloud host over SSL — direct connection, no bastion.
    },
    odoo_staging: {
      name: 'odoo_staging',
      type: 'postgres',
      host: process.env.ODOO_STAGING_DB_HOST || 'localhost',
      port: parseInt(process.env.ODOO_STAGING_DB_PORT || '5432', 10),
      user: process.env.ODOO_STAGING_DB_USER || '',
      password: process.env.ODOO_STAGING_DB_PASSWORD || '',
      database: process.env.ODOO_STAGING_DB_NAME || '',
      // Public Odoo Cloud staging host over SSL — direct connection, no bastion.
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
    // SERP app DB — same Hetzner host as live_darklaunch_db; only the database
    // name differs (serp_app). Connects directly — no SSH tunnel.
    serp_app: {
      name: 'serp_app',
      type: 'mysql',
      host: process.env.LIVE_DARKLAUNCH_DB_HOST || '',
      port: parseInt(process.env.LIVE_DARKLAUNCH_DB_PORT || '3306', 10),
      user: process.env.LIVE_DARKLAUNCH_DB_USER || '',
      password: process.env.LIVE_DARKLAUNCH_DB_PASSWORD || '',
      database: process.env.SERP_APP_DB_NAME || 'serp_app',
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

// Tear down every pool that was routed through the given tunnel key so the next
// query rebuilds against a fresh tunnel. Pools are keyed by database name, so we
// drop every pool whose config still routes through this bastion.
function invalidateTunnel(tunnelKey: string): void {
  activeTunnels.delete(tunnelKey);
  const configs = getDatabaseConfigs();
  for (const [name, cfg] of Object.entries(configs)) {
    if (cfg.ssh?.tunnelKey === tunnelKey) {
      mysqlPools
        .get(name)
        ?.end()
        .catch(() => {});
      mysqlPools.delete(name);
      pgPools
        .get(name)
        ?.end()
        .catch(() => {});
      pgPools.delete(name);
    }
  }
}

// Open (or reuse) the ONE shared SSH tunnel for a bastion and return the local
// forward port. Every database with the same ssh.tunnelKey shares a single SSH
// connection and local listener; the per-socket forwardOut targets that specific
// database's host:port, so one tunnel fronts several remote DBs.
//
// Self-healing: a tunnel that errors/ends removes itself and drops its pools
// (invalidateTunnel), so the NEXT query transparently rebuilds it — a transient
// blip no longer wedges the connection for the whole process (the old permanent
// directConnectionFallbacks latch is gone).
async function createTunnel(config: DatabaseConfig): Promise<number> {
  const ssh = config.ssh;
  if (!ssh) {
    throw new Error('SSH config required for tunnel');
  }

  const tunnelKey = ssh.tunnelKey;

  // Reuse an in-flight or established tunnel for this bastion.
  const existing = activeTunnels.get(tunnelKey);
  if (existing) {
    return existing.ready;
  }

  const ready = new Promise<number>((resolve, reject) => {
    const sshClient = new SSHClient();

    // Read private key
    let privateKey: string;
    try {
      const keyPath = ssh.privateKeyPath.replace('~', process.env.HOME || '');
      privateKey = readFileSync(keyPath, 'utf8');
    } catch {
      activeTunnels.delete(tunnelKey);
      reject(new Error(`Failed to read SSH key: ${ssh.privateKeyPath}`));
      return;
    }

    // Local listener that forwards each accepted socket through the SSH
    // connection to the remote DB this config points at.
    const server = createServer((socket) => {
      sshClient.forwardOut('127.0.0.1', 0, config.host, config.port, (err, stream) => {
        if (err) {
          socket.end();
          return;
        }
        socket.pipe(stream).pipe(socket);
      });
    });

    // Bind the preferred fixed port (so /start-day can probe it); if it's taken
    // or unset, fall back to an ephemeral port so a stale listener never wedges
    // startup.
    const onListening = () => {
      const localPort = (server.address() as AddressInfo).port;

      sshClient.on('ready', () => {
        activeTunnels.set(tunnelKey, { server, sshClient, localPort, ready });
        console.log(`[db] tunnel '${tunnelKey}': listening on 127.0.0.1:${localPort}`);
        resolve(localPort);
      });

      sshClient.on('error', (err) => {
        server.close();
        invalidateTunnel(tunnelKey);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      // Tunnel died — drop it and its pools so the next query rebuilds a fresh one.
      const teardown = () => {
        server.close();
        invalidateTunnel(tunnelKey);
      };
      sshClient.on('close', teardown);
      sshClient.on('end', teardown);

      sshClient.connect({
        host: ssh.host,
        port: ssh.port,
        username: ssh.user,
        privateKey,
      });
    };

    server.once('listening', onListening);
    server.on('error', (err: NodeJS.ErrnoException) => {
      // Preferred fixed port already in use → retry once on an ephemeral port.
      if (err.code === 'EADDRINUSE' && ssh.preferredLocalPort) {
        console.log(
          `[db] tunnel '${tunnelKey}': port ${ssh.preferredLocalPort} in use, using an ephemeral port`
        );
        server.removeAllListeners('error');
        server.on('error', (e) => {
          invalidateTunnel(tunnelKey);
          reject(new Error(`Failed to create tunnel server: ${e.message}`));
        });
        server.listen(0, '127.0.0.1');
        return;
      }
      invalidateTunnel(tunnelKey);
      reject(new Error(`Failed to create tunnel server: ${err.message}`));
    });

    // Prefer the fixed port; fall back to ephemeral via the EADDRINUSE handler.
    server.listen(ssh.preferredLocalPort ?? 0, '127.0.0.1');
  });

  // Register the in-flight promise immediately so concurrent first-queries dedupe
  // onto it rather than each opening a tunnel. Real server/client land in the map
  // on 'ready'; drop the placeholder if the connect rejects.
  activeTunnels.set(tunnelKey, {
    server: undefined as unknown as NetServer,
    sshClient: undefined as unknown as SSHClient,
    localPort: 0,
    ready,
  });
  ready.catch(() => activeTunnels.delete(tunnelKey));

  return ready;
}

// Get effective connection details.
//
// A database with an ssh config REQUIRES the tunnel — its host (the private AWS
// RDS) isn't publicly reachable, so silently connecting direct would just hang.
// So we retry the tunnel once with a short backoff and, if it still fails, throw
// a clear error. There's no permanent direct-fallback latch: the next query
// tries the tunnel fresh, which is what makes a transient blip self-heal.
//
// A database with no ssh config connects directly (Odoo/Retool cloud, Hetzner).
async function getConnectionDetails(
  config: DatabaseConfig
): Promise<{ host: string; port: number; viaTunnel: boolean }> {
  if (config.ssh) {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const localPort = await createTunnel(config);
        console.log(`[db] ${config.name}: connected via SSH tunnel (port ${localPort})`);
        return { host: '127.0.0.1', port: localPort, viaTunnel: true };
      } catch (err) {
        lastErr = err;
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(
          `[db] ${config.name}: SSH tunnel attempt ${attempt} failed (${errorMsg})` +
            (attempt === 1 ? ', retrying…' : '')
        );
        if (attempt === 1) await new Promise((r) => setTimeout(r, 750));
      }
    }
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(
      `${config.name} requires the SSH tunnel to '${config.ssh.host}' but it could not be ` +
        `established: ${msg}. Check LIVE_SSH_HOST/USER/KEY_PATH and bastion reachability.`
    );
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
      // Bound the queue: without this a single wedged connection makes EVERY
      // subsequent query wait forever and then eat the 30s wall-clock guard,
      // which is exactly the "even `SELECT 1` times out" climbing failure. Cap
      // the backlog so an over-subscribed pool fails fast instead of stalling.
      queueLimit: 20,
      // Fail a dead/slow TCP connect in CONNECT_TIMEOUT_MS instead of letting it
      // hang for the full 30s query guard. A `SELECT 1` that "times out" is
      // almost always a stuck connect to a cold Hetzner/RDS host, not a slow
      // query — surfacing that fast is the whole point.
      connectTimeout: CONNECT_TIMEOUT_MS,
    });
    // Server-side query abort for every shape (plain SELECT, CTE, UNION, …):
    // set the session max_execution_time on each new physical connection so
    // MySQL itself kills any statement still running after 30s. SELECT-only at
    // the engine level — harmless for the read-only queries this server runs.
    pool.on('connection', (conn) => {
      conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
    });
    // (mysql2 discards a dropped pooled connection internally on the next
    // acquire — no pool-level 'error' handler needed, unlike pg below.)
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
      // Fail a dead/slow connect fast (see getMySQLPool for the rationale — a
      // trivial query "timing out" is a stuck connect to a cold Odoo/Retool
      // host, not a slow query).
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      // Enable SSL for remote PostgreSQL connections (required by Odoo, Retool)
      ssl: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    });
    // A pooled client that errors while idle (dropped by a cold host) must not
    // crash the process — pg re-emits it on the pool. Log and let the pool
    // discard it so the next acquire builds a fresh connection.
    pool.on('error', (err) => {
      console.error(`[db] ${config.name}: idle pg client error (${err.message}) — discarding`);
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

// Fail a stuck TCP/handshake connect this fast rather than letting it consume
// the full 30s query guard. Kept well under QUERY_TIMEOUT_MS so a genuine
// connection problem is reported as one ("Could not connect to …") instead of
// masquerading as a slow query — the distinction the timeout memory relies on.
const CONNECT_TIMEOUT_MS = 10_000;

// Connection-level failures that mean the physical socket is bad (stale pool
// entry, cold host, dropped tunnel) — NOT a query problem. On these we drop the
// pool and retry once so a transient blip self-heals instead of surfacing as a
// misleading "query timeout".
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
  'ENOTFOUND',
  'EHOSTUNREACH',
]);

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const msg = (err as { message?: string }).message || '';
  return (
    (!!code && CONNECTION_ERROR_CODES.has(code)) ||
    /connect ETIMEDOUT|connect ECONNREFUSED|Connection terminated|connection timeout|timeout expired|Client has encountered a connection error/i.test(
      msg
    )
  );
}

// Drop the cached pool for a database so the next query rebuilds a fresh one.
// Used when a query fails with a connection-level error — the pooled socket is
// dead, so reusing the pool would just fail again.
function dropPool(name: string): void {
  mysqlPools
    .get(name)
    ?.end()
    .catch(() => {});
  mysqlPools.delete(name);
  pgPools
    .get(name)
    ?.end()
    .catch(() => {});
  pgPools.delete(name);
}

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

  // Add LIMIT only to SELECT/WITH statements that don't already have one.
  // Strip a trailing ';' first so `SELECT … ; LIMIT n` (from a .sql file) can't form,
  // and gate on a real LIMIT clause + statement type so `SHOW TABLES`, DESCRIBE, etc.
  // (which take no LIMIT) and identifiers/comments containing the word "limit" are left alone.
  let finalQuery = query.trim().replace(/;+\s*$/, '');
  const isSelect = /^\s*(SELECT|WITH)\b/i.test(finalQuery);
  if (limit && isSelect && !/\bLIMIT\s+\d+/i.test(finalQuery)) {
    finalQuery = `${finalQuery} LIMIT ${limit}`;
  }

  // Run the query, retrying ONCE on a connection-level error with a fresh pool.
  // A dead pooled socket (cold host, dropped tunnel) fails the first attempt;
  // dropping the pool and rebuilding makes a transient blip self-heal instead of
  // surfacing as a misleading "query timeout".
  const runOnce = async (): Promise<QueryResult> => {
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
  };

  try {
    return await runOnce();
  } catch (err) {
    if (isConnectionError(err)) {
      // Stale/dead pooled socket — rebuild once.
      dropPool(config.name);
      try {
        return await runOnce();
      } catch (retryErr) {
        throw enrichError(retryErr, config, finalQuery, true);
      }
    }
    throw await enrichSchemaError(err, config, finalQuery);
  }
}

// Turn a raw connection failure into an actionable message so the caller applies
// the CONNECTION remedy (retry / check the host is up / tunnel), not the
// query-shape timeout memory. Half of observed "Query exceeded 30s timeout"
// errors were trivial queries (SELECT 1) against a cold host — those are
// connection problems wearing a timeout costume.
function enrichError(
  err: unknown,
  config: DatabaseConfig,
  query: string,
  afterRetry: boolean
): Error {
  const raw = (err instanceof Error ? err.message : String(err)).trim();
  const msg = raw || 'connection failed';
  const isTimeout = /exceeded \d+s timeout/i.test(msg);
  const hint = isTimeout
    ? `This looks like a CONNECTION problem, not a slow query — a trivial query timing out means the connect to '${config.name}' (${config.host || 'tunnel'}) hung. `
    : '';
  return new Error(
    `Could not connect to '${config.name}'${afterRetry ? ' (after 1 retry)' : ''}: ${msg}. ` +
      `${hint}Check the host is reachable and the pool/tunnel is healthy, then retry.`
  );
}

// When a query fails because a column/table doesn't exist, append the table's
// REAL columns to the error. The "describe_table first" rule is often skipped;
// this turns a blind schema guess into a self-correcting loop by handing the
// caller the actual schema on the spot instead of leaving them to guess again.
async function enrichSchemaError(
  err: unknown,
  config: DatabaseConfig,
  query: string
): Promise<Error> {
  const msg = err instanceof Error ? err.message : String(err);
  const m =
    /Unknown column '([^']+)'/.exec(msg) || /column "?([\w.]+)"? does not exist/i.exec(msg);
  if (!m) return err instanceof Error ? err : new Error(msg);

  // Best-effort: find the first real table name in the query and describe it.
  const tbl = /\bFROM\s+`?([a-zA-Z_][\w]*)`?/i.exec(query)?.[1];
  if (!tbl) return err instanceof Error ? err : new Error(msg);
  try {
    const cols = await describeTable(config.name, tbl);
    const names = cols.map((c) => c.column).join(', ');
    return new Error(
      `${msg}\n\nColumn '${m[1]}' is not on '${tbl}'. Real columns of ${config.name}.${tbl}: ${names}. ` +
        `(Run mcp__db__describe_table BEFORE querying an unfamiliar table to avoid this.)`
    );
  } catch {
    return err instanceof Error ? err : new Error(msg);
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

  // Close SSH tunnels (guard against a placeholder still connecting).
  for (const tunnel of activeTunnels.values()) {
    tunnel.server?.close();
    tunnel.sshClient?.end();
  }
  activeTunnels.clear();
}
