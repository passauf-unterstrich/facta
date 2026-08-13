const SEITENGROESSE = 1000;

type SeitenErgebnis = {
	data: unknown[] | null;
	error: unknown;
};

/**
 * Lädt eine Supabase-Abfrage vollständig, auch wenn das Projekt pro
 * Antwort höchstens 1.000 Zeilen ausliefert.
 */
export async function ladeAlleSeiten<T>(
	ladeSeite: (von: number, bis: number) => PromiseLike<SeitenErgebnis>
): Promise<T[]> {
	const alle: T[] = [];

	for (let von = 0; ; von += SEITENGROESSE) {
		const { data, error } = await ladeSeite(von, von + SEITENGROESSE - 1);
		if (error) throw error;

		const seite = (data ?? []) as T[];
		alle.push(...seite);

		if (seite.length < SEITENGROESSE) return alle;
	}
}
