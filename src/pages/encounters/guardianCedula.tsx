import { GuardianCedulaIcon, MaskedValue } from "../../components/ui";
import type { EncounterPatientSummary } from "../../services/types";
import { formatCedula } from "../../utils/cedula";

/**
 * A minor's guardian cedula is shown in place of their own, with a marker
 * icon calling that out -- same rule Patients.tsx applies to its own cedula
 * column. Shared by the Encounters list column and the admission detail
 * dialog so the two surfaces can never drift apart on when the guardian
 * cedula (vs. the patient's own) is displayed.
 */
export function GuardianAwareCedula({ info }: { info: EncounterPatientSummary }) {
  const showsGuardian = (info.age ?? 99) < 18 && info.has_guardian && !!info.guardian_cedula;
  const raw = showsGuardian ? info.guardian_cedula : info.cedula;
  const formatted = raw ? (raw.includes("•") ? raw : formatCedula(raw)) : "";
  return (
    <>
      {showsGuardian && <GuardianCedulaIcon />}
      <MaskedValue value={formatted} />
    </>
  );
}
