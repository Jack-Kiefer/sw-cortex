/**
 * Database Service - Query external databases with SSH tunnel support
 * Provides read-only access to WishDesk, SugarWish, Odoo, Retool
 */

import mysql from 'mysql2/promise';
import pg from 'pg';
import { Client as SSHClient } from 'ssh2';
import { readFileSync } from 'fs';
import { createServer, Server as NetServer, AddressInfo } from 'net';

// Database configuration with optional SSH tunnel
export interface DatabaseConfig {
  name: string;
  type: 'mysql' | 'postgres';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  // SSH tunnel config (optional)
  ssh?: {
    host: string;
    port: number;
    user: string;
    privateKeyPath: string;
  };
}

// Active tunnel tracking
interface TunnelInfo {
  server: NetServer;
  sshClient: SSHClient;
  localPort: number;
}

const activeTunnels: Map<string, TunnelInfo> = new Map();

// Get database configs from environment
export function getDatabaseConfigs(): Record<string, DatabaseConfig> {
  // SSH config (shared across databases that need tunneling)
  const sshConfig = process.env.SSH_BASTION_HOST
    ? {
        host: process.env.SSH_BASTION_HOST,
        port: parseInt(process.env.SSH_BASTION_PORT || '22', 10),
        user: process.env.SSH_BASTION_USER || '',
        privateKeyPath: process.env.SSH_KEY_PATH || '~/.ssh/id_rsa',
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
      ssh: process.env.WISHDESK_USE_SSH === 'true' ? sshConfig : undefined,
    },
    sugarwish: {
      name: 'sugarwish',
      type: 'mysql',
      host: process.env.SUGARWISH_DB_HOST || 'localhost',
      port: parseInt(process.env.SUGARWISH_DB_PORT || '3306', 10),
      user: process.env.SUGARWISH_DB_USER || '',
      password: process.env.SUGARWISH_DB_PASSWORD || '',
      database: process.env.SUGARWISH_DB_NAME || '',
      ssh: process.env.SUGARWISH_USE_SSH === 'true' ? sshConfig : undefined,
    },
    odoo: {
      name: 'odoo',
      type: 'postgres',
      host: process.env.ODOO_DB_HOST || 'localhost',
      port: parseInt(process.env.ODOO_DB_PORT || '5432', 10),
      user: process.env.ODOO_DB_USER || '',
      password: process.env.ODOO_DB_PASSWORD || '',
      database: process.env.ODOO_DB_NAME || '',
      ssh: process.env.ODOO_USE_SSH === 'true' ? sshConfig : undefined,
    },
    retool: {
      name: 'retool',
      type: 'postgres',
      host: process.env.RETOOL_DB_HOST || 'localhost',
      port: parseInt(process.env.RETOOL_DB_PORT || '5432', 10),
      user: process.env.RETOOL_DB_USER || '',
      password: process.env.RETOOL_DB_PASSWORD || '',
      database: process.env.RETOOL_DB_NAME || '',
      ssh: process.env.RETOOL_USE_SSH === 'true' ? sshConfig : undefined,
    },
  };
}

// Create SSH tunnel and return local port
async function createTunnel(
  config: DatabaseConfig
): Promise<number> {
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
    } catch (err) {
      reject(new Error(`Failed to read SSH key: ${config.ssh!.privateKeyPath}`));
      return;
    }

    // Create local server to forward connections
    const server = createServer((socket) => {
      sshClient.forwardOut(
        '127.0.0.1',
        0,
        config.host,
        config.port,
        (err, stream) => {
          if (err) {
            socket.end();
            return;
          }
          socket.pipe(stream).pipe(socket);
        }
      );
    });

    server.listen(0, '127.0.0.1', () => {
      const localPort = (server.address() as AddressInfo).port;

      sshClient.on('ready', () => {
        activeTunnels.set(tunnelKey, { server, sshClient, localPort });
        resolve(localPort);
      });

      sshClient.on('error', (err) => {
        server.close();
        reject(new Error(`SSH connection failed: ${err.message}`));
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

// Get effective connection details (with tunnel if needed)
async function getConnectionDetails(
  config: DatabaseConfig
): Promise<{ host: string; port: number }> {
  if (config.ssh) {
    const localPort = await createTunnel(config);
    return { host: '127.0.0.1', port: localPort };
  }
  return { host: config.host, port: config.port };
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
    const [rows, fields] = await pool.query(finalQuery);
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    return {
      columns: fields ? (fields as mysql.FieldPacket[]).map((f) => f.name) : [],
      rows: rowsArray as Record<string, unknown>[],
      rowCount: rowsArray.length,
    };
  } else {
    const pool = await getPGPool(config);
    const result = await pool.query(finalQuery);
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
