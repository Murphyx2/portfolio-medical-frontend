import { useTranslation } from "react-i18next";

import { PhoneNumberListField } from "../PhoneNumberListField";
import { Field } from "../ui";
import { ServiceCheckboxList } from "../../pages/doctors/ServicePickers";
import { RoomCheckboxList } from "../../pages/doctors/RoomPickers";
import type { Room, Service } from "../../services/types";

/** Médico-detail fields shared between Doctors.tsx's own create/edit form
 * and Users.tsx's inline "Crear médico nuevo" block (see
 * USUARIO_MEDICO_LINK_REQUIREMENTS.md) -- Exequátur, phone(s), correo de
 * contacto, biografía, servicios, salas. `Nombre completo` and `Cuenta de
 * usuario`/`Crear cuenta` stay page-specific, not part of this component. */
export function DoctorProfileFormFields({
  licenseNumber,
  onLicenseNumberChange,
  contactPhone,
  onContactPhoneChange,
  contactPhoneError,
  extraPhones,
  onExtraPhonesChange,
  contactEmail,
  onContactEmailChange,
  bio,
  onBioChange,
  services,
  onServicesChange,
  rooms,
  onRoomsChange,
  serviceOptions,
  roomOptions,
  canEditServices,
  canEditRooms,
}: {
  licenseNumber: string;
  onLicenseNumberChange: (v: string) => void;
  contactPhone: string;
  onContactPhoneChange: (v: string) => void;
  contactPhoneError?: string;
  extraPhones: string[];
  onExtraPhonesChange: (v: string[]) => void;
  contactEmail: string;
  onContactEmailChange: (v: string) => void;
  bio: string;
  onBioChange: (v: string) => void;
  services: number[];
  onServicesChange: (v: number[]) => void;
  rooms: number[];
  onRoomsChange: (v: number[]) => void;
  serviceOptions: Service[];
  roomOptions: Room[];
  canEditServices: boolean;
  canEditRooms: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Field label={t("doctors.license")}>
        <input value={licenseNumber} onChange={(e) => onLicenseNumberChange(e.target.value)} />
      </Field>
      <Field label={t("doctors.contactPhone")}>
        <input
          type="tel"
          inputMode="tel"
          value={contactPhone}
          placeholder="(809) 555-1212"
          maxLength={14}
          aria-invalid={!!contactPhoneError}
          aria-describedby={contactPhoneError ? "doctor-contact-phone-error" : undefined}
          onChange={(e) => onContactPhoneChange(e.target.value)}
        />
        {contactPhoneError && (
          <span id="doctor-contact-phone-error" className="field-error" role="alert">
            {contactPhoneError}
          </span>
        )}
        <PhoneNumberListField
          values={extraPhones}
          onChange={onExtraPhonesChange}
          addLabel={t("patients.addPhone")}
          removeLabel={t("patients.removePhone")}
          itemLabel={t("patients.additionalPhone")}
        />
      </Field>
      <Field label={t("doctors.contactEmail")}>
        <input type="email" value={contactEmail} onChange={(e) => onContactEmailChange(e.target.value)} />
      </Field>
      <Field label={t("doctors.bio")}>
        <textarea value={bio} onChange={(e) => onBioChange(e.target.value)} />
      </Field>
      {canEditServices && (
        // Plain .field-styled div, not the Field/<label> wrapper -- this
        // widget nests its own interactive controls (search input, type
        // select, many checkboxes), which is invalid inside a single
        // <label>, unlike Field's usual one-input case.
        <div className="field">
          <span>{t("doctors.services")}</span>
          <ServiceCheckboxList services={serviceOptions} selected={services} onChange={onServicesChange} />
        </div>
      )}
      {canEditRooms && (
        <div className="field">
          <span>{t("doctors.rooms")}</span>
          <RoomCheckboxList rooms={roomOptions} selected={rooms} onChange={onRoomsChange} />
        </div>
      )}
    </>
  );
}
