import { type Timestamp } from "firebase-admin/firestore";

export type UserRole = "super_admin" | "admin" | "project_manager" | "content_admin" | "client";

export interface UserEntity {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phoneNumber?: string;
  avatarUrl?: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ClientEntity {
  id: string;
  userId: string;
  companyName?: string;
  contactEmail: string;
  phone?: string;
  billingAddress?: string;
  status: "active" | "suspended" | "archived";
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface AdminEntity {
  id: string;
  userId: string;
  email: string;
  role: "super_admin" | "admin" | "project_manager" | "content_admin";
  permissions: string[];
  createdAt: Timestamp | string;
}

export interface ProjectRequestEntity {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  serviceRequired: string;
  projectDescription: string;
  budget?: string;
  expectedCompletionDate?: string;
  referenceWebsites?: string;
  preferredCommunication: string;
  additionalRequirements?: string;
  attachmentPaths: string[];
  status: "new" | "reviewing" | "contacted" | "converted" | "closed";
  createdAt: Timestamp | string;
}

export interface ContactEnquiryEntity {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: "unread" | "in_progress" | "resolved" | "archived";
  createdAt: Timestamp | string;
}

export type ProjectStatus =
  | "inquiry"
  | "requirement_review"
  | "discussion"
  | "proposal"
  | "approved"
  | "payment"
  | "planning"
  | "design"
  | "development"
  | "testing"
  | "client_review"
  | "delivery"
  | "completed"
  | "support";

export interface ProjectEntity {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  assignedAdminId?: string;
  progress: number;
  startedAt?: Timestamp | string;
  dueAt?: Timestamp | string;
  completedAt?: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type MilestoneStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "completed";

export interface MilestoneEntity {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  deadline?: Timestamp | string;
  status: MilestoneStatus;
  progress: number;
  completedAt?: Timestamp | string;
  createdAt: Timestamp | string;
}

export type UpdateVisibility =
  "all_clients" | "selected_clients" | "specific_client" | "specific_project";

export interface ProjectUpdateEntity {
  id: string;
  projectId?: string;
  title: string;
  body: string;
  visibility: UpdateVisibility;
  pinned: boolean;
  publishedAt?: Timestamp | string;
  createdAt: Timestamp | string;
}

export interface MessageEntity {
  id: string;
  projectId: string;
  senderId: string;
  senderRole: "client" | "admin";
  body: string;
  attachments?: string[];
  readBy?: string[];
  createdAt: Timestamp | string;
}

export interface MeetingEntity {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  scheduledAt: Timestamp | string;
  meetingUrl?: string;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  createdAt: Timestamp | string;
}

export interface ClientRequestEntity {
  id: string;
  clientId: string;
  projectId?: string;
  title: string;
  details: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "submitted" | "in_review" | "approved" | "declined" | "completed";
  createdAt: Timestamp | string;
}

export interface DocumentEntity {
  id: string;
  clientId?: string;
  projectId?: string;
  name: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  visibility: "client" | "internal" | "public";
  createdAt: Timestamp | string;
}

export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected" | "clarification_requested";

export interface ProposalEntity {
  id: string;
  clientId: string;
  projectId: string;
  scope: string;
  timeline?: string;
  totalPrice: number;
  currency: string;
  advanceAmount?: number;
  remainingAmount?: number;
  status: ProposalStatus;
  createdAt: Timestamp | string;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled";

export interface InvoiceEntity {
  id: string;
  number: string;
  clientId: string;
  projectId: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: Timestamp | string;
  dueAt?: Timestamp | string;
}

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded";

export interface PaymentEntity {
  id: string;
  clientId: string;
  projectId?: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  gateway?: string;
  gatewayTransactionId?: string;
  status: PaymentStatus;
  paidAt?: Timestamp | string;
  createdAt: Timestamp | string;
}

export interface ReferralEntity {
  id: string;
  referrerClientId: string;
  code: string;
  referredEmail?: string;
  status: "pending" | "qualified" | "rewarded" | "rejected";
  createdAt: Timestamp | string;
}

export interface ShowcaseApprovalEntity {
  id: string;
  projectId: string;
  clientId: string;
  isApproved: boolean;
  allowedMedia?: string[];
  notes?: string;
  signedAt?: Timestamp | string;
  createdAt: Timestamp | string;
}

export interface OtpRequestEntity {
  id: string;
  identifier: string; // phone or email
  type: "email" | "phone";
  expiresAt: Timestamp | string;
  attempts: number;
  consumed: boolean;
  createdAt: Timestamp | string;
}

export interface NotificationEntity {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string;
  read: boolean;
  createdAt: Timestamp | string;
}

export type ActivityAction =
  | "account_created"
  | "project_request_submitted"
  | "project_created"
  | "project_updated"
  | "message_sent"
  | "file_uploaded"
  | "proposal_created"
  | "invoice_created"
  | "payment_completed"
  | "showcase_approved"
  | "showcase_published"
  | "account_deleted";

export interface ActivityLogEntity {
  id: string;
  actorId: string;
  actorRole: string;
  action: ActivityAction | string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  timestamp: Timestamp | string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}
