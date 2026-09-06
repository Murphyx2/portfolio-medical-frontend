import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog, Field } from "../../components/ui";
import { HabitStatusPills } from "../../components/HabitStatusPills";
import type {
  ActividadFisicaHabit,
  ActividadFisicaStatus,
  AlcoholHabit,
  CafeHabit,
  HabitsDraft,
  HabitsSnapshot,
  MedicalRecord,
  OtroHabitItem,
  PsicoactivasHabit,
  SubstanceHabitStatus,
  SuenoHabit,
  SuenoStatus,
  TabacoHabit,
  VapeoHabit,
} from "../../services/types";
import type { WorkingEntryFields } from "../../hooks/useDraftSave";
import { formatDateTime } from "../../utils/date";

type TFn = ReturnType<typeof useTranslation>["t"];

const SUBSTANCE_STATUSES: SubstanceHabitStatus[] = ["no_registrado", "nunca", "ex", "ocasional", "activo"];
const ACTIVIDAD_STATUSES: ActividadFisicaStatus[] = ["no_registrado", "sedentario", "insuficiente", "adecuado", "intenso"];
const SUENO_STATUSES: SuenoStatus[] = ["no_registrado", "reparador", "irregular", "insomnio"];

const DIET_TAG_KEYS = [
  "balanceada", "ultraprocesados", "azucares", "sodio", "fibra",
  "vegetariana", "vegana", "ayuno", "restriccion", "otro",
] as const;

/** Local flat multi-toggle over a fixed vocabulary -- reuses .ap-chip/.ap-chip-row
 * verbatim (same visual as the personal-AP chip picker) but is plain local
 * state, not a catalog-backed resource like ApMultiSelect. */
function ChipMultiToggle({ options, values, onChange, disabled }: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(v: string) {
    if (disabled) return;
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <div className="ap-chip-row">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`ap-chip${values.includes(opt.value) ? " selected" : ""}`}
          disabled={disabled}
          onClick={() => toggle(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange, disabled, min, max, step, suffix }: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          placeholder="—"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {suffix && <span className="habit-help-text">{suffix}</span>}
      </span>
    </Field>
  );
}

interface HabitCardShellProps<S extends string> {
  title: string;
  status: S;
  statusOptions: { value: S; label: string }[];
  warnStatuses: S[];
  onStatusChange: (v: S) => void;
  hasTypedDetails: boolean;
  needsDetail: boolean;
  snapshotAt: string | null;
  disabled: boolean;
  children: React.ReactNode;
}

/** Layer A (name + status pills + last date, always visible) + Layer B
 * (detail panel, only rendered when needsDetail is true) -- spec §4. */
function HabitCardShell<S extends string>({
  title, status, statusOptions, warnStatuses, onStatusChange,
  hasTypedDetails, needsDetail, snapshotAt, disabled, children,
}: HabitCardShellProps<S>) {
  const { t } = useTranslation();
  const [pendingStatus, setPendingStatus] = useState<S | null>(null);

  function requestStatusChange(next: S) {
    const nextNeedsDetail = next !== statusOptions[0].value; // caller passes needsDetailStatuses via options ordering guard below
    if (!nextNeedsDetail && needsDetail && hasTypedDetails) {
      setPendingStatus(next);
      return;
    }
    onStatusChange(next);
  }

  return (
    <div className="habit-card">
      <div className="habit-card-header">
        <div className="name">{title}</div>
        <HabitStatusPills
          name={title}
          value={status}
          options={statusOptions}
          onChange={requestStatusChange}
          disabled={disabled}
          warnStatuses={warnStatuses}
        />
        <span className="date">{snapshotAt ? formatDateTime(snapshotAt) : "—"}</span>
      </div>
      {needsDetail && <div className="habit-detail-panel">{children}</div>}

      {pendingStatus !== null && (
        <ConfirmDialog
          title={t("records.habitsCollapseConfirmTitle")}
          message={t("records.habitsCollapseConfirmMessage")}
          confirmLabel={t("common.yes")}
          onConfirm={() => {
            onStatusChange(pendingStatus);
            setPendingStatus(null);
          }}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-substance detail field sets
// ---------------------------------------------------------------------------

function TabacoDetails({ value, onChange, disabled, t }: {
  value: TabacoHabit; onChange: (v: TabacoHabit) => void; disabled: boolean; t: TFn;
}) {
  const tipoOptions = ["cigarrillo", "puro", "pipa", "mascar"].map((v) => ({
    value: v, label: t(`records.habitTipo${v[0].toUpperCase()}${v.slice(1)}`, { defaultValue: v }),
  }));
  const packYears = value.cantidad_dia && value.tiempo_anios
    ? ((value.cantidad_dia / 20) * value.tiempo_anios).toFixed(1)
    : null;
  return (
    <>
      <div className="habit-detail-grid">
        <Field label={t("records.habitTipo")}>
          <ChipMultiToggle
            options={tipoOptions}
            values={value.tipo ?? []}
            onChange={(tipo) => onChange({ ...value, tipo })}
            disabled={disabled}
          />
        </Field>
        <NumberField
          label={t("records.habitCantidadDia")}
          value={value.cantidad_dia}
          onChange={(cantidad_dia) => onChange({ ...value, cantidad_dia })}
          disabled={disabled}
          min={1}
          suffix={t("records.habitCigDia")}
        />
        <NumberField
          label={t("records.habitTiempo")}
          value={value.tiempo_anios}
          onChange={(tiempo_anios) => onChange({ ...value, tiempo_anios })}
          disabled={disabled}
          min={0}
          step={0.5}
          suffix={t("records.habitUnidadAnios")}
        />
        {value.status === "ex" && (
          <Field label={t("records.habitDejoFecha")}>
            <input
              type="month"
              disabled={disabled}
              value={value.dejo_fecha ?? ""}
              onChange={(e) => onChange({ ...value, dejo_fecha: e.target.value || null })}
            />
          </Field>
        )}
      </div>
      <label className="habit-switch">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!value.humo_ajeno}
          onChange={(e) => onChange({ ...value, humo_ajeno: e.target.checked })}
        />
        {t("records.humoAjeno")}
      </label>
      {packYears && <span className="badge habit-badge-info">{t("records.packYearsBadge", { value: packYears })}</span>}
    </>
  );
}

function VapeoDetails({ value, onChange, disabled, t }: {
  value: VapeoHabit; onChange: (v: VapeoHabit) => void; disabled: boolean; t: TFn;
}) {
  return (
    <div className="habit-detail-grid">
      <NumberField
        label={value.frecuencia_tipo === "dias_semana" ? t("records.habitDiasSemanaFreq") : t("records.habitVecesDia")}
        value={value.frecuencia_valor}
        onChange={(frecuencia_valor) => onChange({ ...value, frecuencia_valor })}
        disabled={disabled}
        min={0}
      />
      <NumberField
        label={t("records.habitNicotinaMg")}
        value={value.nicotina_mg}
        onChange={(nicotina_mg) => onChange({ ...value, nicotina_mg })}
        disabled={disabled}
        min={0}
      />
      <Field label={t("records.habitTipo")}>
        <ChipMultiToggle
          options={[
            { value: "con_nicotina", label: t("records.habitConNicotina") },
            { value: "sin_nicotina", label: t("records.habitSinNicotina") },
          ]}
          values={value.nicotina ?? []}
          onChange={(nicotina) => onChange({ ...value, nicotina })}
          disabled={disabled}
        />
      </Field>
      <NumberField
        label={t("records.habitTiempo")}
        value={value.tiempo_anios}
        onChange={(tiempo_anios) => onChange({ ...value, tiempo_anios })}
        disabled={disabled}
        min={0}
        step={0.5}
        suffix={t("records.habitUnidadMeses")}
      />
      {value.status === "ex" && (
        <Field label={t("records.habitDejoFecha")}>
          <input
            type="month"
            disabled={disabled}
            value={value.dejo_fecha ?? ""}
            onChange={(e) => onChange({ ...value, dejo_fecha: e.target.value || null })}
          />
        </Field>
      )}
    </div>
  );
}

function AlcoholDetails({ value, onChange, disabled, t }: {
  value: AlcoholHabit; onChange: (v: AlcoholHabit) => void; disabled: boolean; t: TFn;
}) {
  return (
    <>
      <div className="habit-detail-grid">
        <NumberField
          label={t("records.habitUdSemana")}
          value={value.ud_semana}
          onChange={(ud_semana) => onChange({ ...value, ud_semana })}
          disabled={disabled}
          min={0}
        />
        <NumberField
          label={t("records.habitTiempo")}
          value={value.tiempo_anios}
          onChange={(tiempo_anios) => onChange({ ...value, tiempo_anios })}
          disabled={disabled}
          min={0}
          step={0.5}
          suffix={t("records.habitUnidadAnios")}
        />
        {value.status === "ex" && (
          <Field label={t("records.habitDejoBebFecha")}>
            <input
              type="month"
              disabled={disabled}
              value={value.dejo_fecha ?? ""}
              onChange={(e) => onChange({ ...value, dejo_fecha: e.target.value || null })}
            />
          </Field>
        )}
      </div>
      <ChipMultiToggle
        options={[
          { value: "cerveza", label: t("records.habitBebidaCerveza") },
          { value: "vino", label: t("records.habitBebidaVino") },
          { value: "licor", label: t("records.habitBebidaLicor") },
          { value: "otro", label: t("records.habitBebidaOtro") },
        ]}
        values={value.bebida ?? []}
        onChange={(bebida) => onChange({ ...value, bebida })}
        disabled={disabled}
      />
      <p className="habit-help-text">{t("records.alcoholHelpText")}</p>
    </>
  );
}

function CafeDetails({ value, onChange, disabled, t }: {
  value: CafeHabit; onChange: (v: CafeHabit) => void; disabled: boolean; t: TFn;
}) {
  return (
    <div className="habit-detail-grid">
      <NumberField
        label={t("records.habitTazasDia")}
        value={value.tazas_dia}
        onChange={(tazas_dia) => onChange({ ...value, tazas_dia })}
        disabled={disabled}
        min={0}
      />
      <Field label={t("records.habitTipo")}>
        <ChipMultiToggle
          options={[
            { value: "cafe", label: t("records.habitTipoCafe") },
            { value: "te", label: t("records.habitTipoTe") },
            { value: "energetica", label: t("records.habitTipoEnergetica") },
            { value: "mate", label: t("records.habitTipoMate") },
          ]}
          values={value.tipo ?? []}
          onChange={(tipo) => onChange({ ...value, tipo })}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function PsicoactivasDetails({ value, onChange, disabled, t }: {
  value: PsicoactivasHabit; onChange: (v: PsicoactivasHabit) => void; disabled: boolean; t: TFn;
}) {
  const [showVia, setShowVia] = useState(!!value.via);
  return (
    <div className="habit-detail-grid">
      <Field label={t("records.habitTipo")}>
        <ChipMultiToggle
          options={[
            { value: "marihuana", label: t("records.habitTipoMarihuana") },
            { value: "cocaina", label: t("records.habitTipoCocaina") },
            { value: "benzo", label: t("records.habitTipoBenzo") },
            { value: "inhalantes", label: t("records.habitTipoInhalantes") },
            { value: "otro", label: t("records.dietOtro") },
          ]}
          values={value.tipo ?? []}
          onChange={(tipo) => onChange({ ...value, tipo })}
          disabled={disabled}
        />
      </Field>
      <Field label={t("records.habitFrecuencia")}>
        <select
          disabled={disabled}
          value={value.frecuencia ?? ""}
          onChange={(e) => onChange({ ...value, frecuencia: e.target.value })}
        >
          <option value="">—</option>
          <option value="diaria">{t("records.habitFrecuenciaDiaria")}</option>
          <option value="semanal">{t("records.habitFrecuenciaSemanal")}</option>
          <option value="mensual">{t("records.habitFrecuenciaMensual")}</option>
          <option value="esporadica">{t("records.habitFrecuenciaEsporadica")}</option>
        </select>
      </Field>
      <NumberField
        label={t("records.habitTiempo")}
        value={value.tiempo_anios}
        onChange={(tiempo_anios) => onChange({ ...value, tiempo_anios })}
        disabled={disabled}
        min={0}
        step={0.5}
        suffix={t("records.habitUnidadAnios")}
      />
      {value.status === "ex" && (
        <Field label={t("records.habitDejoFecha")}>
          <input
            type="month"
            disabled={disabled}
            value={value.dejo_fecha ?? ""}
            onChange={(e) => onChange({ ...value, dejo_fecha: e.target.value || null })}
          />
        </Field>
      )}
      {!showVia ? (
        <button type="button" className="btn ghost small" disabled={disabled} onClick={() => setShowVia(true)}>
          {t("records.addVia")}
        </button>
      ) : (
        <Field label={t("records.habitVia")}>
          <select
            disabled={disabled}
            value={value.via ?? ""}
            onChange={(e) => onChange({ ...value, via: e.target.value })}
          >
            <option value="">—</option>
            <option value="oral">{t("records.habitViaOral")}</option>
            <option value="fumada">{t("records.habitViaFumada")}</option>
            <option value="inhalada">{t("records.habitViaInhalada")}</option>
            <option value="inyectada">{t("records.habitViaInyectada")}</option>
          </select>
        </Field>
      )}
    </div>
  );
}

function ActividadFisicaDetails({ value, onChange, disabled, t }: {
  value: ActividadFisicaHabit; onChange: (v: ActividadFisicaHabit) => void; disabled: boolean; t: TFn;
}) {
  const caption = value.dias_semana && value.minutos_sesion
    ? t("records.habitActividadCaption", { value: value.dias_semana * value.minutos_sesion })
    : null;
  const hintKey = ({
    sedentario: "habitSedentarioHint", insuficiente: "habitInsuficienteHint",
    adecuado: "habitAdecuadoHint", intenso: "habitIntensoHint",
  } as Record<string, string>)[value.status];
  return (
    <>
      <div className="habit-detail-grid">
        <NumberField
          label={t("records.habitDiasSemana")}
          value={value.dias_semana}
          onChange={(dias_semana) => onChange({ ...value, dias_semana })}
          disabled={disabled}
          min={0}
          max={7}
        />
        <NumberField
          label={t("records.habitMinutosSesion")}
          value={value.minutos_sesion}
          onChange={(minutos_sesion) => onChange({ ...value, minutos_sesion })}
          disabled={disabled}
          min={0}
        />
        <Field label={t("records.habitTipoActividad")}>
          <input
            type="text"
            placeholder={t("records.habitTipoActividadPlaceholder")}
            disabled={disabled}
            value={value.tipo ?? ""}
            onChange={(e) => onChange({ ...value, tipo: e.target.value })}
          />
        </Field>
      </div>
      {caption && <p className="habit-help-text">{caption}</p>}
      {hintKey && <p className="habit-help-text">{t(`records.${hintKey}`)}</p>}
    </>
  );
}

function SuenoDetails({ value, onChange, disabled, t }: {
  value: SuenoHabit; onChange: (v: SuenoHabit) => void; disabled: boolean; t: TFn;
}) {
  return (
    <div className="habit-detail-grid">
      <NumberField
        label={t("records.habitHorasNoche")}
        value={value.horas_noche}
        onChange={(horas_noche) => onChange({ ...value, horas_noche })}
        disabled={disabled}
        min={0}
        max={14}
        step={0.5}
      />
      <label className="habit-switch">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!value.duerme_mal}
          onChange={(e) => onChange({ ...value, duerme_mal: e.target.checked })}
        />
        {t("records.duermeMal")}
      </label>
      <label className="habit-switch">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!value.somnolencia_diurna}
          onChange={(e) => onChange({ ...value, somnolencia_diurna: e.target.checked })}
        />
        {t("records.somnolenciaDiurna")}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function RecordHabitsSection({ workingEntry, updateField, record, canEdit }: {
  workingEntry: WorkingEntryFields;
  updateField: (patch: Partial<WorkingEntryFields>) => void;
  record: MedicalRecord;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const habits = workingEntry.habits;
  const snapshot: HabitsSnapshot = record.habits_snapshot || {};

  function setHabit<K extends keyof HabitsDraft>(key: K, value: HabitsDraft[K]) {
    updateField({ habits: { ...habits, [key]: value } });
  }

  const substanceStatusOptions = SUBSTANCE_STATUSES.map((s) => ({ value: s, label: t(`records.habitStatus${cap(s)}`) }));
  const actividadStatusOptions = ACTIVIDAD_STATUSES.map((s) => ({ value: s, label: t(`records.habitStatus${cap(s)}`) }));
  const suenoStatusOptions = SUENO_STATUSES.map((s) => ({ value: s, label: t(`records.habitStatus${cap(s)}`) }));

  const CHIP_WARN_STATUSES: Record<string, string> = {
    tabaco: "activo", alcohol: "activo", cafe: "activo", vapeo: "activo", psicoactivas: "activo",
    actividad_fisica: "sedentario", sueno: "insomnio",
  };

  const livingChips: { key: string; label: string; warn: boolean }[] = [];
  const chipLine = (key: string, labelKey: string) => {
    const entry = snapshot[key as keyof HabitsSnapshot] as { status?: string; pack_years?: string } | undefined;
    if (!entry || entry.status === "no_registrado") return;
    let text = `${t(`records.${labelKey}`)} · ${t(`records.habitStatus${cap(entry.status ?? "")}`)}`;
    if (entry.pack_years) text += ` · ${t("records.packYearsBadge", { value: entry.pack_years })}`;
    livingChips.push({ key, label: text, warn: entry.status === CHIP_WARN_STATUSES[key] });
  };
  (["tabaco", "alcohol", "cafe", "vapeo", "psicoactivas", "actividad_fisica", "sueno"] as const).forEach((k) =>
    chipLine(k, `habit${cap(k === "actividad_fisica" ? "actividadFisica" : k === "vapeo" ? "vapeo" : k)}`)
  );
  if (snapshot.patron_alimentario?.tags?.length) {
    livingChips.push({ key: "patron_alimentario", label: `${t("records.habitPatronAlimentario")} · ${snapshot.patron_alimentario.tags.length}`, warn: false });
  }

  const [expandedKeys, setExpandedKeys] = useState<Set<string> | null>(null);
  function isExpanded(key: string, defaultOpen: boolean) {
    if (expandedKeys === null) return defaultOpen;
    return expandedKeys.has(key);
  }
  function toggleExpanded(key: string, next: boolean) {
    setExpandedKeys((prev) => {
      const base = prev ?? new Set<string>();
      const copy = new Set(base);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }
  function collapseAll() {
    setExpandedKeys(new Set());
  }

  // Signals unsaved habit edits in the current entry -- not a comparison
  // against the living snapshot, since a fresh draft legitimately starts
  // with no habit keys at all even when the snapshot already has content
  // from a prior completed visit (absence = untouched this entry).
  const draftDirty = Object.keys(habits).length > 0;

  const lastRecordEntry = Object.values(snapshot).sort((a, b) =>
    (b && "at" in b ? b.at : "").localeCompare(a && "at" in a ? a.at : "")
  )[0] as { at?: string } | undefined;

  function substanceCard<K extends "tabaco" | "alcohol" | "cafe" | "vapeo" | "psicoactivas">(
    key: K, titleKey: string, needsDetailStatuses: SubstanceHabitStatus[], render: (v: any, onChange: (v: any) => void) => React.ReactNode
  ) {
    const value = habits[key] ?? { status: "no_registrado" as SubstanceHabitStatus };
    const status = value.status ?? "no_registrado";
    const needsDetail = needsDetailStatuses.includes(status);
    const hasTypedDetails = Object.keys(value).some((k) => k !== "status" && (value as any)[k] != null && (value as any)[k] !== "" && !(Array.isArray((value as any)[k]) && (value as any)[k].length === 0));
    const open = isExpanded(key, needsDetail);
    return (
      <HabitCardShell
        key={key}
        title={t(`records.${titleKey}`)}
        status={status}
        statusOptions={substanceStatusOptions}
        warnStatuses={["activo"]}
        onStatusChange={(next) => {
          setHabit(key, { ...value, status: next } as any);
          toggleExpanded(key, needsDetailStatuses.includes(next));
        }}
        hasTypedDetails={hasTypedDetails}
        needsDetail={needsDetail && open}
        snapshotAt={(snapshot[key] as { at?: string } | undefined)?.at ?? null}
        disabled={!canEdit}
      >
        {render(value, (next: any) => setHabit(key, next))}
      </HabitCardShell>
    );
  }

  return (
    <div className="mc-form">
      <div className="habits-toolbar">
        <div>
          <h4>{t("records.habitsSectionTitle")}</h4>
          {lastRecordEntry?.at && (
            <div className="sub">
              {t("records.habitsLastRecord", { date: formatDateTime(lastRecordEntry.at), author: "" })}
            </div>
          )}
          <div className="ap-chip-row habits-chip-summary">
            {livingChips.length === 0 ? (
              <span className="ap-empty-note">{t("records.habitsEmptyState")}</span>
            ) : (
              livingChips.map((c) => (
                <span key={c.key} className={`ap-chip selected${c.warn ? " warn" : ""}`}>
                  {c.label}
                </span>
              ))
            )}
            {draftDirty && <span className="habits-draft-chip">{t("records.habitsDraftPrefix")}</span>}
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={collapseAll}>
          {t("records.hideHabitDetails")}
        </button>
      </div>

      <div className="habits-columns">
        <section className="habit-column">
          <div className="habit-column-card">
            <h5 className="habit-column-header">{t("records.substanciasTitle")}</h5>
            <div className="habit-column-body">
              {substanceCard("tabaco", "habitTabaco", ["ex", "ocasional", "activo"], (v, onChange) => (
                <TabacoDetails value={v} onChange={onChange} disabled={!canEdit} t={t} />
              ))}
              {substanceCard("alcohol", "habitAlcohol", ["ex", "ocasional", "activo"], (v, onChange) => (
                <AlcoholDetails value={v} onChange={onChange} disabled={!canEdit} t={t} />
              ))}
              {substanceCard("cafe", "habitCafe", ["ocasional", "activo"], (v, onChange) => (
                <CafeDetails value={v} onChange={onChange} disabled={!canEdit} t={t} />
              ))}
              {substanceCard("vapeo", "habitVapeo", ["ex", "ocasional", "activo"], (v, onChange) => (
                <VapeoDetails value={v} onChange={onChange} disabled={!canEdit} t={t} />
              ))}
              {substanceCard("psicoactivas", "habitPsicoactivas", ["ex", "ocasional", "activo"], (v, onChange) => (
                <PsicoactivasDetails value={v} onChange={onChange} disabled={!canEdit} t={t} />
              ))}
            </div>
          </div>
        </section>

        <section className="habit-column">
          <div className="habit-column-card">
            <h5 className="habit-column-header">{t("records.estiloVidaTitle")}</h5>
            <div className="habit-column-body">

          {(() => {
            const key = "actividad_fisica" as const;
            const value = habits.actividad_fisica ?? { status: "no_registrado" as ActividadFisicaStatus };
            const status = value.status ?? "no_registrado";
            const needsDetail = status !== "no_registrado";
            const hasTypedDetails = !!(value.dias_semana || value.minutos_sesion || value.tipo);
            const open = isExpanded(key, needsDetail);
            return (
              <HabitCardShell
                title={t("records.habitActividadFisica")}
                status={status}
                statusOptions={actividadStatusOptions}
                warnStatuses={["sedentario"]}
                onStatusChange={(next) => {
                  setHabit("actividad_fisica", { ...value, status: next });
                  toggleExpanded(key, next !== "no_registrado");
                }}
                hasTypedDetails={hasTypedDetails}
                needsDetail={needsDetail && open}
                snapshotAt={snapshot.actividad_fisica?.at ?? null}
                disabled={!canEdit}
              >
                <ActividadFisicaDetails
                  value={value}
                  onChange={(next) => setHabit("actividad_fisica", next)}
                  disabled={!canEdit}
                  t={t}
                />
              </HabitCardShell>
            );
          })()}

          {(() => {
            const key = "sueno" as const;
            const value = habits.sueno ?? { status: "no_registrado" as SuenoStatus };
            const status = value.status ?? "no_registrado";
            const needsDetail = status !== "no_registrado";
            const hasTypedDetails = !!(value.horas_noche || value.duerme_mal || value.somnolencia_diurna);
            const open = isExpanded(key, needsDetail);
            return (
              <HabitCardShell
                title={t("records.habitSueno")}
                status={status}
                statusOptions={suenoStatusOptions}
                warnStatuses={["insomnio"]}
                onStatusChange={(next) => {
                  setHabit("sueno", { ...value, status: next });
                  toggleExpanded(key, next !== "no_registrado");
                }}
                hasTypedDetails={hasTypedDetails}
                needsDetail={needsDetail && open}
                snapshotAt={snapshot.sueno?.at ?? null}
                disabled={!canEdit}
              >
                <SuenoDetails value={value} onChange={(next) => setHabit("sueno", next)} disabled={!canEdit} t={t} />
              </HabitCardShell>
            );
          })()}

          {(() => {
            const key = "patron_alimentario" as const;
            const tags = habits.patron_alimentario?.tags ?? [];
            const open = isExpanded(key, tags.length > 0);
            return (
              <div className="habit-card">
                <div className="habit-card-header">
                  <div className="name">{t("records.habitPatronAlimentario")}</div>
                  {!open ? (
                    <button type="button" className="btn ghost small" disabled={!canEdit} onClick={() => toggleExpanded(key, true)}>
                      {t("records.showDietTags")}
                    </button>
                  ) : null}
                  <span className="date">{snapshot.patron_alimentario?.at ? formatDateTime(snapshot.patron_alimentario.at) : "—"}</span>
                </div>
                {open && (
                  <div className="habit-detail-panel">
                    <ChipMultiToggle
                      options={DIET_TAG_KEYS.map((k) => ({ value: k, label: t(`records.diet${cap(k)}`) }))}
                      values={tags}
                      onChange={(next) => setHabit("patron_alimentario", { tags: next })}
                      disabled={!canEdit}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          <OtrosHabitCard
            items={habits.otros ?? []}
            onChange={(otros) => setHabit("otros", otros)}
            disabled={!canEdit}
          />
            </div>
          </div>
        </section>
      </div>

      <div className="obs">
        <Field label={t("records.habitsNotes")}>
          <textarea
            placeholder={t("records.habitsNotesPlaceholder")}
            disabled={!canEdit}
            value={workingEntry.habits_notes}
            onChange={(e) => updateField({ habits_notes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function OtrosHabitCard({ items, onChange, disabled }: {
  items: OtroHabitItem[];
  onChange: (items: OtroHabitItem[]) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  function addItem() {
    if (!name.trim()) return;
    onChange([...items, { name: name.trim().slice(0, 80), note: note.trim() || undefined }]);
    setName("");
    setNote("");
    setAdding(false);
  }

  return (
    <div className="habit-card">
      {items.map((item, idx) => (
        <div key={idx} className="habit-otro-row">
          <div>
            <strong>{item.name}</strong>
            {item.note && <div className="habit-help-text">{item.note}</div>}
          </div>
          <button
            type="button"
            className="btn ghost small"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
          >
            {t("records.removeHabit")}
          </button>
        </div>
      ))}
      {adding ? (
        <div className="habit-detail-grid">
          <Field label={t("records.otroHabitoName")}>
            <input type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
          </Field>
          <Field label={t("records.otroHabitoNote")}>
            <input type="text" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} />
          </Field>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <button type="button" className="btn primary small" onClick={addItem} disabled={disabled}>
              {t("common.save")}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setAdding(false)} disabled={disabled}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost" disabled={disabled} onClick={() => setAdding(true)}>
          {t("records.addOtroHabito")}
        </button>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
}
