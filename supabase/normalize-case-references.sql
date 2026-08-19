-- Vereinheitlicht ausschließlich die Deckblatt-/Aktenzeichenfelder bekannter Fall-Wurzelkarten.
-- Titel, Inhalte, IDs, Kanten und sonstige Karten bleiben unverändert.

begin;

update public.nodes
set ref = 'Kapitalgesellschaftsrecht I, ' || ref
where id = any (array[
  'u_kap_e1_t1__fall',
  'u_kap_e1_t2__fall',
  'u_kap_e1_t3__fall',
  'u_kap_e3_t1__fall',
  'u_kap_e4_t1__fall',
  'u_kap_e5_t1__fall',
  'u_kap_e6_t1__fall',
  'u_kap_e6_t2__fall',
  'u_kap_e7_t1__fall',
  'u_kap_e8_t1__fall',
  'u_kap_e8_t2__fall',
  'u_kap_e9_t1__fall',
  'u_kap_e10_t1__fall',
  'u_kap_e11_t1__fall',
  'u_kap_e12_t1__fall',
  'u_kap_e13_t1__fall',
  'u_kap_e13_t2__fall',
  'u_kap_e14_t1__fall'
]::text[])
and type = 'fall'
and ref is not null
and ref not like 'Kapitalgesellschaftsrecht I,%';

update public.nodes
set ref = case
  when id = 'fall_holding_gruendung_verhindern_einheit'
    then 'Examinatorium, Einheit 13'
  else 'Examinatorium, ' || ref
end
where id = any (array[
  'fall_ad_hoc_publizitaet_argentinien_e12_2',
  'fall_anfechtung_aktionaersdarlehen_e12_3',
  'fall_aufsichtsratshaftung_verfuegungsrahmen_e9_1',
  'fall_ausschlussklausel_entsendungsrecht_e3_2',
  'fall_beherrschungsvertrag_durchgriff_insider_e10',
  'fall_bezugsrechtsausschluss_kapitalerhoehung_e7_1',
  'fall_directors_dealings_mitteilungspflichten_e11_3',
  'fall_einflussnahme_mehrheitsaktionaer_e2_3',
  'fall_erwerb_eigener_aktien_ueberfremdung_e8_1',
  'fall_faktisches_vorstandsmitglied_aktionaersklage_e5_2',
  'fall_fehlgeschlagene_investition_existenzvernichtung_e6_1',
  'fall_gewinnverwendung_satzungsaenderung_gmbh_e2_1',
  'fall_holding_gruendung_verhindern_einheit',
  'fall_insidergeschaeft_ausgabebetrag_e7_3',
  'fall_insolvenzverschleppung_neuglaeubiger_e3_3',
  'fall_mantelverwendung_vorbelastungshaftung_e8_2',
  'fall_mitteilungspflichten_wertpapierdarlehen_e5_3',
  'fall_open_air_arena_gmbh_co_kg_e11_1',
  'fall_pressemitteilung_mar_e8_3',
  'fall_prospekthaftung_wppg_e2_2',
  'fall_sachkapitalerhoehung_freigabe_wpueg_e6_2',
  'fall_satzungsaenderung_vetorecht_wpueg_e4_1',
  'fall_scheckeinzug_debitorisches_konto_e4_2',
  'fall_stimmverbot_beschlussfeststellung_e5_1',
  'fall_treuepflicht_komplementaer_verguetung_e7_2',
  'fall_ueberteuerter_grundstueckskauf_gmbh_e12_1',
  'fall_verdeckte_sacheinlage_fliessband_e11_2',
  'fall_verlustausgleich_302_aktg_e9_2',
  'fall_wpueg_pflichtangebot_pool_e9_3',
  'fall_zweckaenderung_acting_in_concert_e3_1'
]::text[])
and type = 'fall'
and ref is not null
and ref not like 'Examinatorium,%';

commit;

-- Kontrollausgabe: Erwartet werden 48 eindeutig bezeichnete Fallkarten.
select id, ref
from public.nodes
where id ~ '^u_kap_e[0-9]+_t[0-9]+__fall$'
   or id = any (array[
     'fall_ad_hoc_publizitaet_argentinien_e12_2',
     'fall_anfechtung_aktionaersdarlehen_e12_3',
     'fall_aufsichtsratshaftung_verfuegungsrahmen_e9_1',
     'fall_ausschlussklausel_entsendungsrecht_e3_2',
     'fall_beherrschungsvertrag_durchgriff_insider_e10',
     'fall_bezugsrechtsausschluss_kapitalerhoehung_e7_1',
     'fall_directors_dealings_mitteilungspflichten_e11_3',
     'fall_einflussnahme_mehrheitsaktionaer_e2_3',
     'fall_erwerb_eigener_aktien_ueberfremdung_e8_1',
     'fall_faktisches_vorstandsmitglied_aktionaersklage_e5_2',
     'fall_fehlgeschlagene_investition_existenzvernichtung_e6_1',
     'fall_gewinnverwendung_satzungsaenderung_gmbh_e2_1',
     'fall_holding_gruendung_verhindern_einheit',
     'fall_insidergeschaeft_ausgabebetrag_e7_3',
     'fall_insolvenzverschleppung_neuglaeubiger_e3_3',
     'fall_mantelverwendung_vorbelastungshaftung_e8_2',
     'fall_mitteilungspflichten_wertpapierdarlehen_e5_3',
     'fall_open_air_arena_gmbh_co_kg_e11_1',
     'fall_pressemitteilung_mar_e8_3',
     'fall_prospekthaftung_wppg_e2_2',
     'fall_sachkapitalerhoehung_freigabe_wpueg_e6_2',
     'fall_satzungsaenderung_vetorecht_wpueg_e4_1',
     'fall_scheckeinzug_debitorisches_konto_e4_2',
     'fall_stimmverbot_beschlussfeststellung_e5_1',
     'fall_treuepflicht_komplementaer_verguetung_e7_2',
     'fall_ueberteuerter_grundstueckskauf_gmbh_e12_1',
     'fall_verdeckte_sacheinlage_fliessband_e11_2',
     'fall_verlustausgleich_302_aktg_e9_2',
     'fall_wpueg_pflichtangebot_pool_e9_3',
     'fall_zweckaenderung_acting_in_concert_e3_1'
   ]::text[])
order by ref, id;
