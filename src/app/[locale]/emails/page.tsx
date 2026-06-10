import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth/session';
import { emailChannel } from '@/lib/email/mailer';
import { sendTestEmail } from '@/app/actions/email';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  SENT: 'bg-green-100 text-green-700',
  LOGGED: 'bg-slate-100 text-slate-600',
  FAILED: 'bg-red-100 text-red-700',
};

export default async function EmailsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff(locale);
  const t = await getTranslations('emails');

  const emails = await prisma.emailMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { campaign: { include: { client: true } } },
  });

  const channel = emailChannel();
  const live = channel !== 'demo';

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </header>

      {/* Statut du canal d'envoi : réel (Graph) ou démo (journalisation seule). */}
      <div
        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          live ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        <span aria-hidden>{live ? '✓' : '⚠'}</span>
        <span>{channel === 'graph' ? t('channelLive') : channel === 'smtp' ? t('channelLiveSmtp') : t('channelDemo')}</span>
      </div>

      {/* Test de délivrabilité avant d'inviter un vrai bêta-testeur. */}
      <form action={sendTestEmail} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{t('testTitle')}</h2>
          <p className="mb-2 text-xs text-slate-500">{t('testHint')}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="email" name="to" required placeholder={t('testPlaceholder')} className="input max-w-xs" />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">
          {t('testSend')}
        </button>
      </form>

      {emails.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('date')}</th>
                <th className="px-4 py-3">{t('recipient')}</th>
                <th className="px-4 py-3">{t('subject')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('channel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emails.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                    {e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2">
                    {e.recipient}
                    {e.campaign && (
                      <span className="ml-1 font-mono text-[10px] text-slate-300">{e.campaign.client.clientCode}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{e.subject}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{e.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
