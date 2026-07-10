// Dieses Vokabular sprechen ALLE: Datenbank, API, jede Svelte-Seite.
// Vertippst du dich irgendwo, meckert VS Code sofort beim Tippen —
// statt dass es später zur Laufzeit kracht.

export type KartenTyp = 'fall' | 'schema' | 'definition' | 'subsumtion' | 'simpel';

export type Karte = {
	id: string;
	type: KartenTyp;
	area: string | null;
	front: string;
	back: string;
    title: string | null;
	ref: string | null;
	created_at: string;
	updated_at: string;
};

export type Kante = {
	id: number;
	from_id: string;
	to_id: string;
	label: string | null;
	position: number | null;
};

// Ein Kind = Zielkarte plus die Infos der Kante, die dorthin führt.
// So braucht die Kinder-Liste einer Karte nur einen einzigen Typ.
export type Kind = Karte & {
	edge_id: number;
	label: string | null;
	position: number | null;
};

// Was die Detail-API liefert: die Karte selbst + ihre Kinder
export type KarteMitKindern = {
	node: Karte;
	children: Kind[];
};

// Das Austauschformat. Bewusst EIN Format für drei Zwecke:
// Import, Export/Backup, und das, was deine KI-Pipeline liefert.
// (created_at etc. fehlen absichtlich — die vergibt die DB selbst.)
export type FactaExport = {
	nodes: Array<{
		id: string;
		type: KartenTyp;
		area?: string | null;
		front: string;
		back?: string;
		title?: string | null;
		ref?: string | null;
	}>;
	edges: Array<{
		from_id: string;
		to_id: string;
		label?: string | null;
		position?: number | null;
	}>;
};
// Der Entwurf einer Karte im Bauen-Modus — gebündelt statt fünf Parameter
export type BauDaten = {
	type: KartenTyp;
	front: string;
	back: string;
	title: string | null;
	ref: string | null;
};
