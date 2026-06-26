import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

const TIMEOUT_MS = 5000;
const compilerCache = new Map<string, { compile: (src: string) => string }>();

function getCompiler(version: string) {
	if (compilerCache.has(version)) return compilerCache.get(version)!;

	const dir = `/tmp/purus-${version}`;
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		execSync(`npm install purus@${version} --prefix ${dir} --no-save --quiet`, {
			timeout: 30_000,
			stdio: 'ignore'
		});
	}

	const req = createRequire(join(dir, 'node_modules/purus/pkg/index.js'));
	const mod = req(join(dir, 'node_modules/purus/pkg/index.js'));
	compilerCache.set(version, mod);
	return mod as { compile: (src: string) => string };
}

function runInNode(js: string): { stdout: string; stderr: string } {
	const lines: string[] = [];
	const errs: string[] = [];
	const ctx = vm.createContext({
		console: {
			log: (...a: unknown[]) => lines.push(a.map(String).join(' ')),
			error: (...a: unknown[]) => errs.push(a.map(String).join(' ')),
			warn: (...a: unknown[]) => errs.push(a.map(String).join(' ')),
			info: (...a: unknown[]) => lines.push(a.map(String).join(' '))
		},
		Math,
		JSON,
		Date,
		parseInt,
		parseFloat,
		isNaN,
		isFinite,
		String,
		Number,
		Boolean,
		Array,
		Object,
		Error,
		TypeError,
		RangeError,
		Promise,
		setTimeout: (fn: () => void, ms: number) => {
			if (ms < 2000) setTimeout(fn, ms);
		},
		clearTimeout,
		process: {
			env: {},
			argv: ['node'],
			version: 'v22.0.0',
			platform: 'linux',
			stdout: { write: (s: string) => lines.push(s) },
			stderr: { write: (s: string) => errs.push(s) },
			exit: () => {}
		}
	});
	try {
		const script = new vm.Script(js);
		script.runInContext(ctx, { timeout: TIMEOUT_MS });
	} catch (e: unknown) {
		errs.push(e instanceof Error ? e.message : String(e));
	}
	return { stdout: lines.join('\n'), stderr: errs.join('\n') };
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body.code !== 'string') {
		throw error(400, 'Missing code');
	}

	const { code, version = 'latest', mode = 'node' } = body as {
		code: string;
		version?: string;
		mode?: 'node' | 'browser' | 'compile';
	};

	if (code.length > 50_000) throw error(413, 'Code too large');
	if (!/^[\d.]+$|^latest$/.test(version)) throw error(400, 'Invalid version');

	// Compile
	let compiler: { compile: (src: string) => string };
	try {
		compiler = getCompiler(version);
	} catch (e) {
		throw error(500, `Failed to load purus@${version}: ${e}`);
	}

	let compiled: string;
	try {
		compiled = compiler.compile(code);
	} catch (e: unknown) {
		return json({
			success: false,
			compiled: '',
			stdout: '',
			stderr: e instanceof Error ? e.message : String(e),
			mode
		});
	}

	// Compile-only: just return compiled JS, no execution
	if (mode === 'compile') {
		return json({ success: true, compiled, stdout: '', stderr: '', mode });
	}

	if (mode === 'browser') {
		// Return compiled JS for browser sandbox execution
		return json({ success: true, compiled, stdout: '', stderr: '', mode });
	}

	// Node.js mode: execute server-side
	const { stdout, stderr } = runInNode(compiled);
	return json({ success: true, compiled, stdout, stderr, mode });
};