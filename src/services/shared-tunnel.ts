/**
 * The machine-wide jump tunnel (`ssh -N serp-jump`, kept alive by SERP's
 * `scripts/serp-tunnel.sh install-launchd`) forwards fixed local ports to the
 * remote databases. Its LocalForward lines in ~/.ssh/config are the single list
 * of what it serves, so the db tools read them from `ssh -G` instead of keeping
 * a second copy, and use the shared port when it answers. When it does not, the
 * caller falls back to its own in-process tunnel, so a down tunnel never breaks
 * a query.
 *
 * SHARED_TUNNEL_HOST names the ssh Host alias (default `serp-jump`); set it to
 * `false` to turn this off.
 */
import { execFileSync } from 'child_process';
import { connect } from 'net';

export interface LocalForward {
  localPort: number;
  host: string;
  port: number;
}

/** Parses `ssh -G` output lines like `localforward 13306 [db.example.com]:3306`. */
export function parseLocalForwards(sshGOutput: string): LocalForward[] {
  const forwards: LocalForward[] = [];
  for (const line of sshGOutput.split('\n')) {
    const m = /^localforward\s+(?:[^\s:]+:)?(\d+)\s+\[?([^\]\s]+?)\]?:(\d+)\s*$/i.exec(line.trim());
    if (m) forwards.push({ localPort: Number(m[1]), host: m[2].toLowerCase(), port: Number(m[3]) });
  }
  return forwards;
}

let cached: LocalForward[] | undefined;

function sharedForwards(): LocalForward[] {
  if (cached) return cached;
  const alias = process.env.SHARED_TUNNEL_HOST ?? 'serp-jump';
  if (!alias || alias === 'false') return (cached = []);
  try {
    const out = execFileSync('ssh', ['-G', alias], { encoding: 'utf8', timeout: 5000 });
    cached = parseLocalForwards(out);
  } catch {
    cached = [];
  }
  return cached;
}

function portAnswers(port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** The shared tunnel's local port for host:port, or undefined if it is not forwarded or not answering. */
export async function sharedTunnelPort(host: string, port: number): Promise<number | undefined> {
  const match = sharedForwards().find((f) => f.host === host.toLowerCase() && f.port === port);
  if (!match) return undefined;
  return (await portAnswers(match.localPort)) ? match.localPort : undefined;
}
