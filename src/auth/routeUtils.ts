import type { AppRole } from "@/auth/authTypes";

export function getDefaultRouteForRole(role: AppRole): string {
  switch (role) {
    case "Transporter":
      return "/transporter/epod";
    case "Ops":
      return "/ops/epod";
    case "Reviewer":
      return "/reviewer/epod";
    default:
      return "/login";
  }
}

export function getTransporterEpodPath() {
  return "/transporter/epod";
}

export function getTransporterUploadPath() {
  return "/transporter/epod/upload";
}

export function getEpodListPathForRole(role: AppRole): string {
  switch (role) {
    case "Transporter":
      return "/transporter/epod";
    case "Ops":
      return "/ops/epod";
    case "Reviewer":
      return "/reviewer/epod";
    default:
      return "/login";
  }
}

export function getEpodUploadPathForRole(role: AppRole): string {
  switch (role) {
    case "Transporter":
      return "/transporter/epod/upload";
    case "Ops":
      return "/ops/epod/upload";
    case "Reviewer":
      return "/reviewer/epod/upload";
    default:
      return "/login";
  }
}

export function getEpodReviewPathForRole(role: AppRole, id: string): string {
  switch (role) {
    case "Transporter":
      return `/transporter/epod/${id}/review`;
    case "Ops":
      return `/ops/epod/${id}/review`;
    case "Reviewer":
      return `/reviewer/epod/${id}/review`;
    default:
      return "/login";
  }
}

export function getOpsQueuePath() {
  return "/ops/epod";
}

export function getReviewerQueuePath() {
  return "/reviewer/epod";
}

export function getRoleReviewPath(role: AppRole, id: string) {
  return getEpodReviewPathForRole(role, id);
}
