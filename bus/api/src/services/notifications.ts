import admin from "firebase-admin";
import { Types } from "mongoose";
import { getFirebaseApp } from "./firebase.js";
import { AdminModel } from "../models/Admin.js";
import { DriverModel } from "../models/Driver.js";
import { StudentModel } from "../models/Student.js";

export type Audience =
  | { role: "admin"; id: string | Types.ObjectId }
  | { role: "driver"; id: string | Types.ObjectId }
  | { role: "student"; id: string | Types.ObjectId }
  | { role: "students"; ids: (string | Types.ObjectId)[] };

export type PushPayload = {
  title: string;
  body: string;
  // Extra string-keyed data delivered to the client. Values are coerced to
  // strings because FCM data payloads only support strings.
  data?: Record<string, string | number | boolean | undefined | null>;
};

// Best-effort multi-recipient send. Returns the number of tokens that
// delivered successfully. Tokens reported unregistered/invalid are pruned
// from their owner document so we don't keep sending to dead devices.
export async function sendPush(
  audience: Audience,
  payload: PushPayload
): Promise<number> {
  const app = getFirebaseApp();
  if (!app) return 0;

  const recipients = await resolveRecipients(audience);
  const tokens = recipients.flatMap((r) => r.tokens);
  if (tokens.length === 0) return 0;

  const messaging = admin.messaging(app);
  const data = normalizeData(payload.data);

  // Custom ringtone. On Android the sound is bound to the notification
  // channel — the "bus-alerts" channel is created client-side in
  // MainApplication.kt with res/raw/bus_ringtone.mp3. On iOS the file
  // must be bundled with the app (bus_ringtone.mp3 in the Xcode target).
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data,
    android: {
      notification: {
        channelId: "bus-alerts",
        sound: "bus_ringtone",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "bus_ringtone.mp3",
        },
      },
    },
    webpush: {
      notification: { title: payload.title, body: payload.body, icon: "/favicon.ico" },
      fcmOptions: data.url ? { link: data.url } : undefined,
    },
  });

  await pruneInvalidTokens(recipients, tokens, response);

  return response.successCount;
}

// Fire-and-forget wrapper: never throws, never blocks the caller's promise
// chain. Use this inside route handlers so a notification failure can't fail
// the underlying request.
export function sendPushSafe(audience: Audience, payload: PushPayload): void {
  sendPush(audience, payload).catch((err) => {
    console.error("[fcm] sendPush failed:", err);
  });
}

type Recipient = {
  role: "admin" | "driver" | "student";
  _id: Types.ObjectId;
  tokens: string[];
};

async function resolveRecipients(audience: Audience): Promise<Recipient[]> {
  switch (audience.role) {
    case "admin": {
      const doc = await AdminModel.findById(audience.id).select("fcmTokens").lean();
      return doc ? [{ role: "admin", _id: doc._id, tokens: doc.fcmTokens ?? [] }] : [];
    }
    case "driver": {
      const doc = await DriverModel.findById(audience.id).select("fcmTokens").lean();
      return doc ? [{ role: "driver", _id: doc._id, tokens: doc.fcmTokens ?? [] }] : [];
    }
    case "student": {
      const doc = await StudentModel.findById(audience.id).select("fcmTokens").lean();
      return doc ? [{ role: "student", _id: doc._id, tokens: doc.fcmTokens ?? [] }] : [];
    }
    case "students": {
      if (audience.ids.length === 0) return [];
      const docs = await StudentModel.find({ _id: { $in: audience.ids } })
        .select("fcmTokens")
        .lean();
      return docs.map((d) => ({ role: "student", _id: d._id, tokens: d.fcmTokens ?? [] }));
    }
  }
}

function normalizeData(
  data: PushPayload["data"]
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function pruneInvalidTokens(
  recipients: Recipient[],
  tokens: string[],
  response: admin.messaging.BatchResponse
) {
  const dead = new Set<string>();
  response.responses.forEach((r, i) => {
    if (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) {
      dead.add(tokens[i]);
    }
  });
  if (dead.size === 0) return;

  const byRole = { admin: [] as Recipient[], driver: [] as Recipient[], student: [] as Recipient[] };
  for (const r of recipients) byRole[r.role].push(r);

  const ops: Promise<unknown>[] = [];
  if (byRole.admin.length)
    ops.push(
      AdminModel.updateMany(
        { _id: { $in: byRole.admin.map((r) => r._id) } },
        { $pull: { fcmTokens: { $in: [...dead] } } }
      )
    );
  if (byRole.driver.length)
    ops.push(
      DriverModel.updateMany(
        { _id: { $in: byRole.driver.map((r) => r._id) } },
        { $pull: { fcmTokens: { $in: [...dead] } } }
      )
    );
  if (byRole.student.length)
    ops.push(
      StudentModel.updateMany(
        { _id: { $in: byRole.student.map((r) => r._id) } },
        { $pull: { fcmTokens: { $in: [...dead] } } }
      )
    );
  await Promise.allSettled(ops);
}
