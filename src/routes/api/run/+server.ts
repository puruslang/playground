import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import vm from 'vm';
import { spawnSync } from 'child_process'; // execSync not needed; spawnSync avoids shell injection
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const TIMEOUT_MS = 5000;

// ── Bundled compiler (the version installed as a dependency) ──────────────
// We use a dynamic import so it doesn't fail at module-parse time if missing.
let bundledCompiler: { compile: (src: string) => string } | null = null;
let bundledVersion = 'unknown';

async function loadBundled() {
	if (bundledCompiler) return;
	try {
		const mod = await import('purus');
		bundledCompiler = mod as unknown as { compile: (src: string) => string };
		// Read installed version via createRequire (avoids JSON import attribute issues)
		const req = createRequire(import.meta.url);
		bundledVersion = (req('purus/package.json') as { version: string }).version;
	} catch {
		// Will fail gracefully — bundledCompiler stays null
	}
}

// ── Cache for dynamically installed versions ──────────────────────────────
const installedCache = new Map<string, { compile: (src: string) => string }>();

function installVersion(version: string): { compile: (src: string) => string } {
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
	const mod = req(modPath) as { compile: (src: string) => string };
	installedCache.set(version, mod);
	return mod;
}

// ── Pick compiler ─────────────────────────────────────────────────────────
async function getCompiler(version: string): Promise<{ compile: (src: string) => string }> {
	await loadBundled();

	// Use bundled package for 'latest' or the exact installed version
	if (bundledCompiler && (version === 'latest' || version === bundledVersion)) {
		return bundledCompiler;
	}

	// Specific older version → dynamic install
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

	if (code.length > 50_000) throw error(413, 'Code too large');
	if (!/^[\d.]+$|^latest$/.test(version)) throw error(400, 'Invalid version');

	let compiler: { compile: (src: string) => string };
	try {
		compiler = await getCompiler(version);
	} catch (e) {
		return json({
			success: false, compiled: '', stdout: '',
			stderr: `Compiler load failed: ${e}`,
			mode
		});
	}

	if (!compiler?.compile) {
		return json({
			success: false, compiled: '', stdout: '',
			stderr: 'Compiler not available. Please try the default version.',
			mode
		});
	}

	let compiled: string;
	try {
		compiled = compiler.compile(code);
	} catch (e: unknown) {
		return json({
			success: false, compiled: '', stdout: '',
			stderr: e instanceof Error ? e.message : String(e),
			mode
		});
	}

	if (mode === 'compile') {
		return json({ success: true, compiled, stdout: '', stderr: '', mode });
	}
	if (mode === 'browser') {
		return json({ success: true, compiled, stdout: '', stderr: '', mode });
	}

	const { stdout, stderr } = runInNode(compiled);
	return json({ success: true, compiled, stdout, stderr, mode });
};
