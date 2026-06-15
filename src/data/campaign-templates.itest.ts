import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { CAMPAIGN_TEMPLATES } from './campaign-templates';

// Les 5 modèles de campagne (objet métier) doivent être seedés et actifs.

describe('seed des modèles de campagne', () => {
  it('chaque modèle est présent en base', async () => {
    const keys = CAMPAIGN_TEMPLATES.map((t) => t.key);
    const found = await prisma.campaignTemplate.findMany({ where: { key: { in: keys } }, select: { key: true } });
    const foundKeys = new Set(found.map((t) => t.key));
    expect(keys.filter((k) => !foundKeys.has(k))).toEqual([]);
  });
});
