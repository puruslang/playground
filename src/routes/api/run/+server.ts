import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import vm from 'vm';
import { spawnSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const TIMEOUT_MS = 5000;

// ── Types ─────────────────────────────────────────────────────────────────
interface CompileOpts { strict?: boolean; type?: string; header?: boolean; cjs?: boolean }
type Compiler = { compile: (src: string, opts?: CompileOpts) => string };

// ── Config parser ─────────────────────────────────────────────────────────
function parseConfig(content: string): CompileOpts {
	const opts: CompileOpts = { header: false };
	for (const line of content.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('--')) continue;
		const m = t.match(/^const\s+([\w.-]+)\s+be\s+(.+)$/);
		if (!m) continue;
		const key = m[1];
		let val: string | boolean = m[2].trim();
		// Support both ///.../// and //;...;// string formats
		if (val.startsWith('///') && val.endsWith('///')) val = val.slice(3, -3);
		else if (val.startsWith('//;') && val.endsWith(';//')) val = val.slice(3, -3);
		else if (val === 'true') val = true;
		else if (val === 'false') val = false;
		if (key === 'strict') opts.strict = val as boolean;
		if (key === 'type') {
			opts.type = val as string;
			opts.cjs = (val as string) === 'commonjs';
		}
	}
	return opts;
}

// ── Bundled compiler ──────────────────────────────────────────────────────
let bundledCompiler: Compiler | null = null;
let bundledVersion = 'unknown';

async function loadBundled() {
	if (bundledCompiler) return;
	try {
		const mod = await import('purus');
		bundledCompiler = mod as unknown as Compiler;
		const req = createRequire(import.meta.url);
		bundledVersion = (req('purus/package.json') as { version: string }).version;
	} catch {
		// bundledCompiler stays null
	}
}

// ── Dynamic install (older versions) ─────────────────────────────────────
const installedCache = new Map<string, Compiler>();

function installVersion(version: string): Compiler {
	if (installedCache.has(version)) return installedCache.get(version)!;

	const dir = `/tmp/purus-v${version}`;
	const modPath = join(dir, 'node_modules', 'purus', 'pkg', 'index.js');

	if (!existsSync(modPath)) {
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, 'package.json'),
			JSON.stringify({ name: 'tmp', version: '0.0.0', dependencies: { purus: version } })
		);
		const result = spawnSync('npm', ['install', '--prefix', dir, '--no-save', '--quiet'], {
			timeout: 30_000,
			encoding: 'utf8',
			env: { ...process.env, npm_config_cache: '/tmp/.npm-cache' }
		});
		if (result.status !== 0) {
			throw new Error(
				`npm install purus@${version} failed. ` +
				`Use the default version (currently ${bundledVersion}) to avoid this.`
			);
		}
	}

	const req = createRequire(modPath);
	const mod = req(modPath) as Compiler;
	installedCache.set(version, mod);
	return mod;
}

async function getCompiler(version: string): Promise<Compiler> {
	await loadBundled();
	if (bundledCompiler && (version === 'latest' || version === bundledVersion)) {
		return bundledCompiler;
	}
	return installVersion(version);
}

// ── Sandbox execution ─────────────────────────────────────────────────────
function runInNode(js: string): { stdout: string; stderr: string } {
	const lines: string[] = [];
	const errs: string[] = [];
	const ctx = vm.createContext({
		console: {
			log:   (...a: unknown[]) => lines.push(a.map(String).join(' ')),
			error: (...a: unknown[]) => errs.push(a.map(String).join(' ')),
			warn:  (...a: unknown[]) => errs.push(a.map(String).join(' ')),
			info:  (...a: unknown[]) => lines.push(a.map(String).join(' '))
		},
		Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
		String, Number, Boolean, Array, Object,
		Error, TypeError, RangeError, Promise,
		setTimeout: (fn: () => void, ms: number) => { if (ms < 2000) setTimeout(fn, ms); },
		clearTimeout,
		process: {
			env: {}, argv: ['node'], version: 'v22.0.0', platform: 'linux',
			stdout: { write: (s: string) => lines.push(s) },
			stderr: { write: (s: string) => errs.push(s) },
			exit: () => {}
		}
	});
	try {
		new vm.Script(js).runInContext(ctx, { timeout: TIMEOUT_MS });
	} catch (e: unknown) {
		errs.push(e instanceof Error ? e.message : String(e));
	}
	return { stdout: lines.join('\n'), stderr: errs.join('\n') };
}

// ── Route handler ─────────────────────────────────────────────────────────
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.code !== 'string') throw error(400, 'Missing code');

	const { code, version = 'latest', mode = 'node' } = body as {
		code: string;
		version?: string;
		mode?: 'node' | 'browser' | 'compile';
	};
	const configContent: string = typeof body.config === 'string' ? body.config : '';

	if (code.length > 50_000) throw error(413, 'Code too large');
	if (!/^[\d.]+$|^latest$/.test(version)) throw error(400, 'Invalid version');

	let compiler: Compiler;
	try {
		compiler = await getCompiler(version);
	} catch (e) {
		return json({ success: false, compiled: '', stdout: '', stderr: `Compiler load failed: ${e}`, mode });
	}

	if (!compiler?.compile) {
		return json({ success: false, compiled: '', stdout: '', stderr: 'Compiler not available. Please try the default version.', mode });
	}

	// Apply config.purus options to compilation
	const compileOpts = parseConfig(configContent);

	let compiled: string;
	try {
		compiled = compiler.compile(code, compileOpts);
	} catch (e: unknown) {
		return json({ success: false, compiled: '', stdout: '', stderr: e instanceof Error ? e.message : String(e), mode });
	}

	if (mode === 'compile') return json({ success: true, compiled, stdout: '', stderr: '', mode });
	if (mode === 'browser') return json({ success: true, compiled, stdout: '', stderr: '', mode });

	const { stdout, stderr } = runInNode(compiled);
	return json({ success: true, compiled, stdout, stderr, mode });
};
