import { apiFetch } from "./client";

/** Who an announcement goes to. */
export type AudienceChoice = "students" | "drivers" | "both";

/**
 * `total` is everyone on the books; `withDevice` is how many of them have
 * opened the app on a phone and so have somewhere to receive an alert. The
 * gap between the two is what the compose form shows, so nobody reads
 * "38 of 42" as a failure.
 */
export type Reach = { total: number; withDevice: number };

export type AudienceInfo = {
  students: Reach;
  drivers: Reach;
  /** False when the server has no Firebase credentials — nothing can send. */
  pushConfigured: boolean;
};

export type SendResult = {
  ok: true;
  /** Devices the notification service accepted the message for. */
  devices: number;
  sentTo: { students: Reach; drivers: Reach };
};

export const collegeNotificationsApi = {
  audience: (collegeId: string) =>
    apiFetch<AudienceInfo>(`/api/colleges/${collegeId}/notifications/audience`),
  send: (
    collegeId: string,
    input: { title: string; body: string; audience: AudienceChoice }
  ) =>
    apiFetch<SendResult>(`/api/colleges/${collegeId}/notifications`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const TITLE_MAX = 80;
export const BODY_MAX = 300;
