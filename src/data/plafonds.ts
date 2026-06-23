// Barèmes / plafonds de déductions par ANNÉE FISCALE (Genève — ICC & IFD).
//
// ⚠️ Couche de CALCUL / RÉFÉRENCE, pas de collecte. Les montants changent chaque
// année : ajouter une entrée par année dans PLAFONDS_PAR_ANNEE. Valeurs 2025
// indicatives (barème ICC sauf mention) — seuls les lois/règlements officiels
// (GeTax / AFC-GE) font foi ; à valider pièce par pièce avant production.

export type Bareme = 'ICC' | 'IFD';

export interface Plafonds {
  year: number;
  /** Forfait frais professionnels = pct du revenu net, borné [min, max]. */
  fraisProForfait: { pct: number; iccMin: number; iccMax: number; ifdMin: number; ifdMax: number };
  /** Frais de déplacement (plafond annuel). */
  fraisDeplacement: { icc: number; ifd: number };
  /** Frais de repas hors domicile, selon participation de l'employeur. */
  fraisRepas: {
    sansParticipation: { parJour: number; max: number };
    avecParticipation: { parJour: number; max: number };
  };
  /** 3e pilier A : montant fixe si affilié au 2e pilier, sinon pct du revenu net borné. */
  pilier3a: { affilie2ePilier: number; sansPct: number; sansMax: number };
  /** Primes d'assurance-maladie (plafonds ICC) par catégorie d'âge. */
  primesMaladieIcc: { enfant: number; jeune19a25: number; adulte: number };
  /** Frais de garde par enfant, jusqu'au mois du Nᵉ anniversaire. */
  fraisGarde: { iccParEnfant: number; ifdParEnfant: number; ageLimite: number };
  /** Charge d'un enfant / proche nécessiteux (ICC). */
  chargeProche: { iccEntiere: number; iccDemi: number };
  /** Déduction couple marié (IFD). */
  coupleMarie: { ifd: number };
  /** Versements à un parti politique (plafonds). */
  partisPolitiques: { icc: number; ifd: number };
}

export const PLAFONDS_PAR_ANNEE: Record<number, Plafonds> = {
  2025: {
    year: 2025,
    fraisProForfait: { pct: 0.03, iccMin: 640, iccMax: 1812, ifdMin: 2000, ifdMax: 4000 },
    fraisDeplacement: { icc: 534, ifd: 3300 },
    fraisRepas: {
      sansParticipation: { parJour: 15, max: 3200 },
      avecParticipation: { parJour: 7.5, max: 1600 },
    },
    pilier3a: { affilie2ePilier: 7258, sansPct: 0.2, sansMax: 36288 },
    primesMaladieIcc: { enfant: 3965, jeune19a25: 12842, adulte: 17122 },
    fraisGarde: { iccParEnfant: 26320, ifdParEnfant: 25800, ageLimite: 14 },
    chargeProche: { iccEntiere: 13660, iccDemi: 6830 },
    coupleMarie: { ifd: 2800 },
    partisPolitiques: { icc: 10000, ifd: 10600 },
  },
};

/** Années pour lesquelles un barème est défini (croissant). */
export function anneesDisponibles(): number[] {
  return Object.keys(PLAFONDS_PAR_ANNEE).map(Number).sort((a, b) => a - b);
}

/**
 * Barème applicable pour une année. `exact=false` si l'année n'est pas définie :
 * on retombe sur l'année connue la plus récente <= year (sinon la plus ancienne),
 * pour ne jamais renvoyer de valeurs nulles — à signaler dans l'UI.
 */
export function plafondsFor(year: number): { plafonds: Plafonds; exact: boolean } {
  const exact = PLAFONDS_PAR_ANNEE[year];
  if (exact) return { plafonds: exact, exact: true };
  const annees = anneesDisponibles();
  const inferieure = annees.filter((y) => y <= year).pop();
  const choisie = inferieure ?? annees[0];
  return { plafonds: PLAFONDS_PAR_ANNEE[choisie], exact: false };
}

/** Forfait frais professionnels = pct du revenu net, borné selon le barème. */
export function forfaitFraisPro(revenuNet: number, bareme: Bareme, p: Plafonds): number {
  const brut = Math.max(0, revenuNet) * p.fraisProForfait.pct;
  const min = bareme === 'ICC' ? p.fraisProForfait.iccMin : p.fraisProForfait.ifdMin;
  const max = bareme === 'ICC' ? p.fraisProForfait.iccMax : p.fraisProForfait.ifdMax;
  return Math.min(Math.max(brut, min), max);
}

/** Plafond 3e pilier A : fixe si affilié au 2e pilier, sinon pct du revenu net borné. */
export function plafond3a(affilie2ePilier: boolean, revenuNet: number, p: Plafonds): number {
  if (affilie2ePilier) return p.pilier3a.affilie2ePilier;
  return Math.min(Math.max(0, revenuNet) * p.pilier3a.sansPct, p.pilier3a.sansMax);
}

/** Format CHF suisse (séparateur apostrophe), ex. 7258 -> "7'258". Déterministe. */
export function formatChf(n: number): string {
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const sign = n < 0 ? '-' : '';
  const dec = decPart.replace(/0+$/, '');
  return dec ? `${sign}${grouped}.${dec}` : `${sign}${grouped}`;
}
