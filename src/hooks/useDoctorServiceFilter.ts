import type { DoctorProfile, Service, ServiceType } from "../services/types";

/** Mutual doctor<->service filtering: a doctor with a restricted `services`
 * list only offers a subset of services, and only services whose type
 * `requires_doctor` participate in narrowing the Doctor dropdown at all
 * (e.g. lab-only services stay freely selectable no matter which doctor, if
 * any, is picked). Originally inline in EncounterFormModal (Admission form);
 * extracted so Appointments' single-service selection can reuse the same
 * rule instead of re-deriving it.
 *
 * Deliberately does NOT own room filtering (Encounter-specific) or
 * service-*line* management (add/remove/quantity, also Encounter-specific)
 * -- those stay local to EncounterFormModal. `selectedServiceIds` is
 * whatever the caller currently has picked (a single id for Appointments, or
 * every service line's id for Encounters) -- the hook filters it down to the
 * doctor-bound subset internally. */
export function useDoctorServiceFilter({
  doctors,
  services,
  serviceTypes,
  selectedServiceIds,
  currentDoctorId,
}: {
  doctors: DoctorProfile[];
  services: Service[];
  serviceTypes: ServiceType[];
  selectedServiceIds: number[];
  currentDoctorId: number;
}) {
  function isDoctorBoundService(serviceId: number): boolean {
    const svc = services.find((sv) => sv.id === serviceId);
    const st = serviceTypes.find((t) => t.id === svc?.type);
    return st?.requires_doctor ?? true;
  }

  /** A doctor stays a valid pick as long as they're unrestricted (no
   * `services` assigned) or provide at least one of the given doctor-bound
   * service ids. */
  function eligibleForDoctor(doctor: DoctorProfile | undefined, serviceIds: number[]): boolean {
    if (!doctor || doctor.services.length === 0) return true;
    const boundIds = serviceIds.filter((id) => id && isDoctorBoundService(id));
    if (boundIds.length === 0) return true;
    return boundIds.some((id) => doctor.services.includes(id));
  }

  const doctorBoundSelectedIds = selectedServiceIds.filter((id) => id && isDoctorBoundService(id));
  const currentDoctor = doctors.find((d) => d.id === currentDoctorId);

  // Doctor dropdown: unrestricted doctors always show; restricted ones show
  // only if they provide at least one of the currently-selected doctor-bound
  // services.
  const availableDoctors = doctors.filter(
    (d) =>
      d.services.length === 0 ||
      doctorBoundSelectedIds.length === 0 ||
      d.services.some((id) => doctorBoundSelectedIds.includes(id)),
  );

  // Service picker: once a doctor with a non-empty services list is picked,
  // narrow doctor-bound services to what they actually offer -- services
  // whose type doesn't require a doctor stay available regardless.
  const availableServices =
    currentDoctor && currentDoctor.services.length > 0
      ? services.filter((sv) => !isDoctorBoundService(sv.id) || currentDoctor.services.includes(sv.id))
      : services;

  return { isDoctorBoundService, eligibleForDoctor, availableDoctors, availableServices, currentDoctor };
}
