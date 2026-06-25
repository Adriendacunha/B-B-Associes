import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireStaff } from '@/lib/auth/session';
import { Link } from '@/i18n/routing';
import { anneesDisponibles, plafondsFor, formatChf } from '@/data/plafonds';

export const dynamic = 'force-dynamic';

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 py-1.5 text-sm first:border-t-0">
      <span className="text-slate-600">{label}</span>
      <span className="text-right font-medium text-slate-900">
        {value}
        {sub && <span className="ml-1 block text-[11px] font-normal text-slate-400 sm:inline">{sub}</span>}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

const chf = (n: number) => `${formatChf(n)} CHF`;

export default async function BaremesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  const { year } = await searchParams;
  setRequestLocale(locale);
  await requireStaff(locale);
  const t = await getTranslations('home');

  const annees = anneesDisponibles();
  const requested = Number(year) || annees[annees.length - 1];
  const { plafonds: p, exact } = plafondsFor(requested);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('baremes')}</h1>
        <p className="text-sm text-slate-600">
          Plafonds de déductions par année fiscale (Genève — ICC &amp; IFD). Référence interne :
          montants <em>indicatifs</em>, seuls les lois et règlements officiels (GeTax / AFC-GE) font foi.
        </p>
      </header>

      {/* Sélecteur d'année */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Année fiscale :</span>
        {annees.map((y) => (
          <Link
            key={y}
            href={`/baremes?year=${y}`}
            className={`rounded-md px-2.5 py-1 font-medium ${
              y === p.year ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {!exact && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucun barème défini pour {requested} : affichage du barème {p.year} (le plus proche). À paramétrer
          pour l’année concernée avant utilisation.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Frais professionnels">
          <Row
            label="Forfait (3 % du revenu net)"
            value={`${chf(p.fraisProForfait.iccMin)} – ${chf(p.fraisProForfait.iccMax)}`}
            sub={`ICC · IFD ${chf(p.fraisProForfait.ifdMin)} – ${chf(p.fraisProForfait.ifdMax)}`}
          />
          <Row label="Frais de déplacement (max)" value={chf(p.fraisDeplacement.icc)} sub={`ICC · IFD ${chf(p.fraisDeplacement.ifd)}`} />
          <Row
            label="Repas — sans participation employeur"
            value={`${chf(p.fraisRepas.sansParticipation.parJour)}/j`}
            sub={`max ${chf(p.fraisRepas.sansParticipation.max)}/an`}
          />
          <Row
            label="Repas — avec participation"
            value={`${chf(p.fraisRepas.avecParticipation.parJour)}/j`}
            sub={`max ${chf(p.fraisRepas.avecParticipation.max)}/an`}
          />
        </Card>

        <Card title="Prévoyance — 3e pilier A">
          <Row label="Affilié à un 2e pilier (LPP)" value={chf(p.pilier3a.affilie2ePilier)} />
          <Row
            label="Sans 2e pilier"
            value={`${Math.round(p.pilier3a.sansPct * 100)} % du revenu net`}
            sub={`max ${chf(p.pilier3a.sansMax)}`}
          />
        </Card>

        <Card title="Primes d’assurance-maladie (plafond ICC)">
          <Row label="Enfant" value={chf(p.primesMaladieIcc.enfant)} />
          <Row label="Jeune adulte (19–25 ans)" value={chf(p.primesMaladieIcc.jeune19a25)} />
          <Row label="Adulte" value={chf(p.primesMaladieIcc.adulte)} />
        </Card>

        <Card title="Frais de garde">
          <Row
            label="Par enfant (max)"
            value={chf(p.fraisGarde.iccParEnfant)}
            sub={`ICC · IFD ${chf(p.fraisGarde.ifdParEnfant)}`}
          />
          <Row label="Jusqu’au mois du" value={`${p.fraisGarde.ageLimite}e anniversaire`} />
        </Card>

        <Card title="Charges familiales">
          <Row label="Enfant / proche à charge (entière)" value={chf(p.chargeProche.iccEntiere)} sub="ICC" />
          <Row label="Charge partielle (demi)" value={chf(p.chargeProche.iccDemi)} sub="ICC" />
          <Row label="Couple marié (IFD)" value={chf(p.coupleMarie.ifd)} />
        </Card>

        <Card title="Partis politiques">
          <Row label="Versements (max)" value={chf(p.partisPolitiques.icc)} sub={`ICC · IFD ${chf(p.partisPolitiques.ifd)}`} />
        </Card>
      </div>
    </div>
  );
}
