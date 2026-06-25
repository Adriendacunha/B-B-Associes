import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Activity, Coins, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { requireStaff } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { summarize, formatTokens, formatUsd, type ModelAgg } from '@/lib/ai/analytics';

export const dynamic = 'force-dynamic';

const OPERATION_LABEL: Record<string, string> = {
  VERIFY: 'Vérification de pièce',
  CLASSIFY: 'Classification (tri auto)',
};

function Metric({ label, value, sub, Icon }: { label: string; value: string; sub?: string; Icon: typeof Activity }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="mt-0.5 text-xs text-slate-500">{label}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);
  const t = await getTranslations('home');

  const [byModelRaw, byOpRaw, daily, topCampaignsRaw, recent] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ['model'],
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),
    prisma.aiUsage.groupBy({
      by: ['operation'],
      _sum: { inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.$queryRaw<{ day: Date; input: bigint; output: bigint; calls: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COALESCE(SUM("inputTokens"), 0) AS input,
             COALESCE(SUM("outputTokens"), 0) AS output,
             COUNT(*) AS calls
      FROM "AiUsage"
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day DESC LIMIT 30`,
    prisma.aiUsage.groupBy({
      by: ['campaignId'],
      _sum: { inputTokens: true, outputTokens: true },
      _count: true,
      where: { campaignId: { not: null } },
      orderBy: { _sum: { inputTokens: 'desc' } },
      take: 5,
    }),
    prisma.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);

  const modelAggs: ModelAgg[] = byModelRaw.map((r) => ({
    model: r.model,
    calls: r._count,
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
    cacheReadTokens: r._sum.cacheReadTokens ?? 0,
  }));
  const summary = summarize(modelAggs);

  // Noms des campagnes les plus consommatrices.
  const campIds = topCampaignsRaw.map((c) => c.campaignId).filter((x): x is string => Boolean(x));
  const camps = campIds.length
    ? await prisma.campaign.findMany({ where: { id: { in: campIds } }, include: { client: true } })
    : [];
  const campById = new Map(camps.map((c) => [c.id, c]));

  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.input) + Number(d.output)));
  const isEmpty = summary.totalCalls === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('aiUsage')}</h1>
        <p className="text-sm text-slate-600">
          Consommation de tokens des analyses IA (vérification & classification). Coûts <em>estimés</em> —
          tarifs paramétrables (<code>src/lib/ai/pricing.ts</code> ou <code>AI_PRICE_IN/OUT</code>).
        </p>
      </header>

      {isEmpty ? (
        <div className="card text-sm text-slate-600">
          Aucune consommation enregistrée pour l’instant. Les appels au modèle sont comptabilisés
          uniquement lorsque <code>ANTHROPIC_API_KEY</code> est configurée (sinon l’analyseur de
          démonstration local est utilisé, sans coût ni token).
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Appels au modèle" value={String(summary.totalCalls)} Icon={Activity} />
            <Metric label="Tokens d’entrée" value={formatTokens(summary.totalInput)} Icon={ArrowDownToLine} />
            <Metric label="Tokens de sortie" value={formatTokens(summary.totalOutput)} Icon={ArrowUpFromLine} />
            <Metric label="Coût estimé total" value={formatUsd(summary.totalCostUsd)} sub="USD, indicatif" Icon={Coins} />
          </section>

          {/* Par modèle */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Par modèle</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Modèle</th>
                    <th className="pb-2 text-right">Appels</th>
                    <th className="pb-2 text-right">Entrée</th>
                    <th className="pb-2 text-right">Sortie</th>
                    <th className="pb-2 text-right">Coût est.</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.model} className="border-t border-slate-100">
                      <td className="py-1.5 font-mono text-xs text-slate-700">{r.model}</td>
                      <td className="py-1.5 text-right">{r.calls}</td>
                      <td className="py-1.5 text-right">{formatTokens(r.inputTokens)}</td>
                      <td className="py-1.5 text-right">{formatTokens(r.outputTokens)}</td>
                      <td className="py-1.5 text-right font-medium text-slate-800">{formatUsd(r.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Par opération */}
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Par opération</h2>
              <ul className="space-y-2 text-sm">
                {byOpRaw.map((o) => (
                  <li key={o.operation} className="flex items-center justify-between">
                    <span className="text-slate-700">{OPERATION_LABEL[o.operation] ?? o.operation}</span>
                    <span className="text-slate-500">
                      {o._count} appels · {formatTokens((o._sum.inputTokens ?? 0) + (o._sum.outputTokens ?? 0))} tokens
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Top campagnes */}
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Dossiers les plus consommateurs</h2>
              {topCampaignsRaw.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {topCampaignsRaw.map((c) => {
                    const camp = c.campaignId ? campById.get(c.campaignId) : undefined;
                    const tok = (c._sum.inputTokens ?? 0) + (c._sum.outputTokens ?? 0);
                    return (
                      <li key={c.campaignId} className="flex items-center justify-between">
                        <span className="truncate text-slate-700">
                          {camp ? `${camp.client.displayName} · ${camp.fiscalYear}` : c.campaignId}
                        </span>
                        <span className="shrink-0 text-slate-500">{c._count} appels · {formatTokens(tok)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Série journalière (30 j) */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Consommation par jour (30 j)</h2>
            <ul className="space-y-1.5">
              {daily.map((d) => {
                const tok = Number(d.input) + Number(d.output);
                const pct = Math.round((tok / maxDaily) * 100);
                return (
                  <li key={d.day.toISOString()} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-slate-500">
                      {d.day.toISOString().slice(0, 10)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-slate-500">
                      {formatTokens(tok)} · {Number(d.calls)} appels
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Derniers appels */}
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Derniers appels</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Opération</th>
                    <th className="pb-2">Modèle</th>
                    <th className="pb-2 text-right">Entrée</th>
                    <th className="pb-2 text-right">Sortie</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-500">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                      <td className="py-1.5 text-slate-700">{OPERATION_LABEL[r.operation] ?? r.operation}</td>
                      <td className="py-1.5 font-mono text-xs text-slate-500">{r.model}</td>
                      <td className="py-1.5 text-right">{r.inputTokens}</td>
                      <td className="py-1.5 text-right">{r.outputTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
