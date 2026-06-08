// Orchestration de l'analyse d'un document (§7.2) : utilise l'API Claude réelle
// si `ANTHROPIC_API_KEY` est configurée, sinon l'analyseur de démonstration
// déterministe (stub). Renvoie un résultat normalisé prêt à persister (AiVerdict).

import type { AppLocale, LocalizedText } from '@/lib/i18n/locales';
import { stubVerdict } from './stub';
import { verifyDocument } from './client';

export interface AnalyzeArgs {
  pieceCode: string;
  pieceNom: string;
  pieceDescription: string;
  expectedFiscalYear: number;
  clientDisplayName: string;
  acceptedFormats: string[];
  signatureRequired?: boolean;
  clientLocale: AppLocale;
  filename: string;
  /** Texte extrait/OCR du document (vide si non extractible). */
  text: string;
}

export interface AnalysisResult {
  conforme: boolean;
  typeDetecte: string | null;
  anneeDetectee: number | null;
  scoreLisibilite: number;
  anomalies: string[];
  messageClient: LocalizedText;
  model: string;
  raw: unknown;
}

export async function analyzeDocument(args: AnalyzeArgs): Promise<AnalysisResult> {
  // Voie réelle : API Claude avec Zero Data Retention (§9). Le texte fourni est
  // l'extraction OCR ; on retombe sur le stub si la clé n'est pas configurée.
  if (process.env.ANTHROPIC_API_KEY) {
    const { verdict, model, raw } = await verifyDocument(
      {
        code: args.pieceCode,
        nom: args.pieceNom,
        description: args.pieceDescription,
        expectedFiscalYear: args.expectedFiscalYear,
        clientDisplayName: args.clientDisplayName,
        acceptedFormats: args.acceptedFormats,
        signatureRequired: args.signatureRequired,
      },
      args.text || args.filename,
      args.clientLocale,
    );
    // Le modèle renvoie un message dans la langue du client ; on le range sous sa locale.
    const messageClient = { [args.clientLocale]: verdict.message_client } as LocalizedText;
    return {
      conforme: verdict.conforme,
      typeDetecte: verdict.type_detecte,
      anneeDetectee: verdict.annee_detectee,
      scoreLisibilite: verdict.score_lisibilite,
      anomalies: verdict.anomalies,
      messageClient,
      model,
      raw,
    };
  }

  const v = stubVerdict({
    pieceCode: args.pieceCode,
    expectedFiscalYear: args.expectedFiscalYear,
    filename: args.filename,
    text: args.text,
  });
  return {
    conforme: v.conforme,
    typeDetecte: v.type_detecte,
    anneeDetectee: v.annee_detectee,
    scoreLisibilite: v.score_lisibilite,
    anomalies: v.anomalies,
    messageClient: v.message_client,
    model: 'stub-demo',
    raw: { stub: true },
  };
}
