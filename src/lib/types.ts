// Dieses Vokabular sprechen ALLE: Datenbank, API, jede Svelte-Seite.
// Vertippst du dich irgendwo, meckert VS Code sofort beim Tippen.

export type KartenTyp = 'fall' | 'schema' | 'definition' | 'subsumtion' | 'simpel' | 'thema';

// Wie die RÜCKSEITE dargestellt wird — der Text bleibt die Wahrheit,
// der Mode ist nur die Brille: open = Freitext, agls/schema = eine
// Link-Zeile pro Schale.
export type KartenMode = 'open' | 'agls' | 'schema';

export type Karte = {
	id: string;
	type: KartenTyp;
	area: string | null;
	front: string;
	back: string;
	// Chips: drittes Textfeld, eine Link-Zeile pro Chip. Kleine gelbe
	// Bubbles unter der Karte — der Bahnhof (Definition → ihre
	// Subsumtionen, Thema → Vertiefungen). Nimmt am Kanten-Sync teil.
	chips: string;
	title: string | null;
	ref: string | null;
	mode: KartenMode;
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
export type Kind = Karte & {
	edge_id: number;
	label: string | null;
	position: number | null;
};

export type KarteMitKindern = {
	node: Karte;
	children: Kind[];
};

// Das Austauschformat: Import = Export = KI-Pipeline.
export type FactaExport = {
	nodes: Array<{
		id: string;
		type: KartenTyp;
		area?: string | null;
		front: string;
		back?: string;
		chips?: string;
		title?: string | null;
		ref?: string | null;
		mode?: KartenMode;
	}>;
	edges: Array<{
		from_id: string;
		to_id: string;
		label?: string | null;
		position?: number | null;
	}>;
};

// Der Entwurf einer Karte im Bauen-Modus — gebündelt statt sieben Parameter
export type BauDaten = {
	type: KartenTyp;
	front: string;
	back: string;
	chips: string;
	title: string | null;
	ref: string | null;
	mode: KartenMode;
};
