import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const CACHE_TTL = 5 * 60 * 1000; // 5 min
let cachedVersions: string[] | null = null;
let cacheTime = 0;

export const GET: RequestHandler = async () => {
	const now = Date.now();
	if (cachedVersions && now - cacheTime < CACHE_TTL) {
		return json(cachedVersions);
	}

	try {
		const res = await fetch('https://registry.npmjs.org/purus');
		const data = await res.json();
		const versions: string[] = Object.keys(data.versions ?? {})
			.filter((v) => /^\d+\.\d+\.\d+$/.test(v)) // stable only
			.sort((a, b) => {
				const pa = a.split('.').map(Number);
				const pb = b.split('.').map(Number);
				for (let i = 0; i < 3; i++) {
					if (pa[i] !== pb[i]) return pb[i] - pa[i]; // descending
				}
				return 0;
			});
		cachedVersions = versions;
		cacheTime = now;
		return json(versions);
	} catch {
		return json(['1.0.1', '0.11.0'], { status: 200 });
	}
};
