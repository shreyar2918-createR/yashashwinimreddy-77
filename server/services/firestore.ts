import { FieldValue, type CollectionReference, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "../config/firebase-admin";

export const serverTimestamp = () => FieldValue.serverTimestamp();

export function getTypedCollection<T = DocumentData>(
  collectionName: string,
): CollectionReference<T> {
  const db = getAdminDb();
  return db.collection(collectionName) as CollectionReference<T>;
}

export const COLLECTIONS = {
  USERS: "users",
  CLIENTS: "clients",
  ADMINS: "admins",
  PROJECT_REQUESTS: "projectRequests",
  CONTACT_ENQUIRIES: "contactEnquiries",
  PROJECTS: "projects",
  MILESTONES: "milestones",
  PROJECT_UPDATES: "projectUpdates",
  MESSAGES: "messages",
  MEETINGS: "meetings",
  REQUESTS: "requests",
  DOCUMENTS: "documents",
  PROPOSALS: "proposals",
  INVOICES: "invoices",
  PAYMENTS: "payments",
  REFERRALS: "referrals",
  SHOWCASE_APPROVALS: "showcaseApprovals",
  OTP_REQUESTS: "otpRequests",
  NOTIFICATIONS: "notifications",
  ACTIVITY_LOGS: "activityLogs",
} as const;
