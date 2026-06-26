import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { VersionEntry } from '$lib/types';

const CACHE_TTL = 5 * 60 * 1000; // 5 min

let cached: VersionEntry[] | null = null;
let cacheTime = 0;

/** Stable semver only: exactly x.y.z (no pre-release suffix like -dev.xxx or -release.xxx) */
const STABLE_SEMVER = /^\d+\.\d+\.\d+$/;

export const GET: RequestHandler = async () => {
	const now = Date.now();
	if (cached && now - cacheTime < CACHE_TTL) {
		return json(cached);
	}

	try {
		const res = await fetch('https://registry.npmjs.org/purus', {
			headers: { Accept: 'application/vnd.npm.install-v1+json' }
		});
		if (!res.ok) throw new Error(`npm registry returned ${res.status}`);

		const data = await res.json();
		const allVersions: Record<string, { deprecated?: string }> = data.versions ?? {};

		const entries: VersionEntry[] = Object.entries(allVersions)
			.filter(([v]) => STABLE_SEMVER.test(v))
			.map(([v, meta]) => ({
				version: v,
				deprecated: Boolean(meta?.deprecated)
			}))
			.sort((a, b) => {
				const pa = a.version.split('.').map(Number);
				const pb = b.version.split('.').map(Number);
				for (let i = 0; i < 3; i++) {
					if (pa[i] !== pb[i]) return pb[i] - pa[i]; // newest first
				}
				return 0;
			});

		cached = entries;
		cacheTime = now;
		return json(entries);
	} catch (e) {
		console.error('Failed to fetch npm versions:', e);
		// Return empty on error — UI will fall back to manual input
		return json([], { status: 200 });
	}
};