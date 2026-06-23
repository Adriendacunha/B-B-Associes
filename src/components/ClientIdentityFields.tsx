// Champs d'identité d'un client, partagés entre la création (page Clients) et
// l'édition (fiche client). Un seul endroit à maintenir → impossible d'oublier
// un champ dans l'un des deux formulaires. À placer DANS un <form> en grille
// (sm:grid-cols-2). Le <form>, les champs cachés et le bouton restent au parent.

import type { ReactNode } from 'react';

/** Sous-ensemble des champs client nécessaires au pré-remplissage (édition). */
export interface ClientIdentityDefaults {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  birthDate?: Date | null;
  civilStatus?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  pays?: string | null;
  nationality?: string | null;
  permitType?: string | null;
  avsNumber?: string | null;
  religion?: string | null;
  phone?: string | null;
  locale?: string | null;
  gestionnaireId?: string | null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const v = (x: string | null | undefined) => x ?? undefined;
const dateValue = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

export function ClientIdentityFields({
  staff,
  client,
}: {
  staff: { id: string; name: string }[];
  client?: ClientIdentityDefaults;
}) {
  return (
    <>
      <h2 className="text-sm font-semibold text-slate-700 sm:col-span-2">Identité</h2>

      <Field label="Nom *">
        <input name="lastName" required defaultValue={v(client?.lastName)} className="input" placeholder="ex. Meyer" />
      </Field>
      <Field label="Prénom *">
        <input name="firstName" required defaultValue={v(client?.firstName)} className="input" placeholder="ex. Thomas" />
      </Field>

      <Field label="Date de naissance">
        <input type="date" name="birthDate" defaultValue={dateValue(client?.birthDate)} className="input" />
      </Field>
      <Field label="État civil">
        <select name="civilStatus" className="select" defaultValue={v(client?.civilStatus) ?? ''}>
          <option value="">Sélectionner…</option>
          <option value="celibataire">Célibataire</option>
          <option value="marie">Marié·e</option>
          <option value="partenariat">Partenariat enregistré</option>
          <option value="separe">Séparé·e</option>
          <option value="divorce">Divorcé·e</option>
          <option value="veuf">Veuf·ve</option>
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field label="Rue">
          <input name="street" defaultValue={v(client?.street)} className="input" placeholder="ex. Bahnhofstrasse 42" />
        </Field>
      </div>

      <Field label="NPA">
        <input name="postalCode" defaultValue={v(client?.postalCode)} className="input" placeholder="8001" />
      </Field>
      <Field label="Ville">
        <input name="city" defaultValue={v(client?.city)} className="input" placeholder="Zürich" />
      </Field>

      <Field label="Pays">
        <input name="pays" defaultValue={v(client?.pays)} className="input" placeholder="ex. Suisse, France" />
      </Field>
      <Field label="Nationalité">
        <input name="nationality" defaultValue={v(client?.nationality)} className="input" placeholder="ex. CH, FR, DE" />
      </Field>

      <Field label="Type de permis">
        <input name="permitType" defaultValue={v(client?.permitType)} className="input" placeholder="ex. B, C, L" />
      </Field>
      <Field label="Numéro AVS">
        <input name="avsNumber" defaultValue={v(client?.avsNumber)} className="input" placeholder="756.XXXX.XXXX.XX" />
      </Field>

      <Field label="Religion">
        <input name="religion" defaultValue={v(client?.religion)} className="input" placeholder="Pour l'impôt ecclésiastique" />
      </Field>
      <Field label="Téléphone">
        <input name="phone" defaultValue={v(client?.phone)} className="input" placeholder="+41 XX XXX XX XX" />
      </Field>

      <Field label="E-mail du client *">
        <input type="email" name="email" required defaultValue={v(client?.email)} className="input" placeholder="ex. client@email.com" />
      </Field>
      <Field label="Langue">
        <select name="locale" className="select" defaultValue={v(client?.locale) ?? 'FR'}>
          <option value="FR">Français</option>
          <option value="EN">English</option>
          <option value="DE">Deutsch</option>
        </select>
      </Field>

      <Field label="Collaborateur responsable">
        <select name="gestionnaireId" className="select" defaultValue={v(client?.gestionnaireId) ?? staff[0]?.id ?? ''}>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
