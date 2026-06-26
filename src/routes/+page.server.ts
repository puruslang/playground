import type { PageServerLoad } from './$types';
import type { VersionEntry } from '$lib/types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch('/api/versions');
		if (!res.ok) throw new Error(`status ${res.status}`);
		const versions: VersionEntry[] = await res.json();
		return { versions };
	} catch {
		return { versions: [] as VersionEntry[] };
	}
};
