/**
 * VINORA domain types.
 *
 * These mirror the entities that will be created in the Supabase schema during
 * the backend stage. They are declared here so the UI, service layer and future
 * mobile client all share one contract.
 */

export type UserRole = "super_admin" | "admin" | "project_manager" | "content_admin" | "client";

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

export type MilestoneStatus = "not_started" | "in_progress" | "blocked" | "in_review" | "completed";

export type CanonicalProposalStatus =
  "Pending" | "Accepted" | "Rejected" | "Expired" | "Withdrawn" | "Draft";

export type ProposalStatus =
  CanonicalProposalStatus | "draft" | "sent" | "accepted" | "rejected" | "clarification_requested";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded";

export type CanonicalInvoiceStatus =
  "Draft" | "Sent" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";

export type InvoiceStatus =
  | CanonicalInvoiceStatus
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type UpdateVisibility =
  "all_clients" | "selected_clients" | "specific_client" | "specific_project";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string | undefined;
  createdAt: string;
}

export interface ProjectRequest {
  id: string;
  clientId?: string | null | undefined;
  clientProfile?:
    | {
        uid: string;
        email?: string;
        fullName?: string;
        companyName?: string;
        phone?: string;
        role?: string;
      }
    | null
    | undefined;
  name: string;
  email: string;
  businessName?: string | undefined;
  serviceRequired: string;
  projectDescription: string;
  budget?: string | undefined;
  expectedCompletionDate?: string | undefined;
  referenceWebsites?: string | undefined;
  preferredCommunication: string;
  additionalRequirements?: string | undefined;
  attachmentPaths: string[];
  status:
    | "Pending Review"
    | "new"
    | "reviewing"
    | "contacted"
    | "converted"
    | "closed"
    | "Approved"
    | "Rejected"
    | string;
  showcaseApproved?: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string;
  showcaseTitle?: string;
  showcaseDescription?: string;
  imageUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string | undefined;
  isRegisteredClient?: boolean;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  timestamp?: string;
  createdAt: string;
  status: "New" | string;
  uid?: string | null;
  userId?: string | null;
  clientId?: string | null;
  userEmail?: string | null;
  isGuest?: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string;
  category?: string | undefined;
  serviceRequired?: string | undefined;
  status: ProjectStatus | string;
  assignedAdminId?: string | undefined;
  assignedAdminName?: string | undefined;
  startedAt?: string | undefined;
  startDate?: string | undefined;
  dueAt?: string | undefined;
  expectedCompletionDate?: string | undefined;
  progress: number;
  showcaseApproved?: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  imageUrl?: string;
  clientName?: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  milestones?: Milestone[] | undefined;
}

export interface ShowcaseProject {
  id: string;
  source: "projectRequest" | "project";
  title: string;
  clientName?: string;
  businessName?: string;
  category: string;
  description: string;
  details?: {
    serviceRequired?: string;
    budget?: string;
    timeline?: string;
    deliverables?: string[];
    technologies?: string[];
    scope?: string;
  };
  imageUrl?: string;
  status: string;
  showcaseApproved: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  clientId?: string | undefined;
  title: string;
  description?: string | undefined;
  deadline?: string | undefined;
  dueDate?: string | undefined;
  status: MilestoneStatus | "Not Started" | "In Progress" | "Completed" | "On Hold" | string;
  progress: number;
  assigneeId?: string | undefined;
  completedAt?: string | undefined;
  completedDate?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface ProposalBudgetItem {
  id?: string;
  description: string;
  amount: number;
}

export interface ProposalMilestonePlanItem {
  id?: string;
  name: string;
  percentage?: number;
  amount: number;
  dueTrigger?: string;
  status?: "Pending" | "Paid" | "In Progress" | "Completed";
  invoiceId?: string;
  paidAt?: string;
}

export type PaymentPlanType = "full" | "milestone";
export type ProposalPaymentStatus = "Unpaid" | "Advance Paid" | "Fully Paid" | "Partially Paid";

export interface Proposal {
  id: string;
  clientId: string;
  clientUid?: string | undefined;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
  clientCompany?: string | undefined;
  projectId?: string | undefined;
  projectName?: string | undefined;
  projectTitle?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  scope: string;
  deliverables?: string[] | undefined;
  timeline?: string | undefined;
  revisions?: string | undefined;
  totalPrice: number;
  currency: string;
  advanceAmount?: number | undefined;
  remainingAmount?: number | undefined;
  validityDate?: string | undefined;
  terms?: string | undefined;
  notes?: string | undefined;
  status: ProposalStatus;
  createdBy?: string | undefined;
  createdByAdminName?: string | undefined;
  createdByAdminEmail?: string | undefined;
  clientResponse?: string | undefined;
  responseAt?: string | undefined;
  withdrawnAt?: string | undefined;
  withdrawnBy?: string | undefined;
  withdrawnReason?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;

  // Dynamic Budget Breakdown
  budgetItems?: ProposalBudgetItem[] | undefined;
  subtotal?: number | undefined;
  taxRate?: number | undefined;
  tax?: number | undefined;
  discount?: number | undefined;

  // Payment Plan & Settlement Tracking
  paymentPlanType?: PaymentPlanType | undefined;
  milestonePlan?: ProposalMilestonePlanItem[] | undefined;
  paymentStatus?: ProposalPaymentStatus | undefined;
  invoiceId?: string | undefined;
  invoiceNumber?: string | undefined;
}

export interface Payment {
  id: string;
  clientId: string;
  clientUid?: string | undefined;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
  projectId?: string | undefined;
  projectName?: string | undefined;
  proposalId?: string | undefined;
  invoiceId?: string | undefined;
  invoiceNumber?: string | undefined;
  receiptNumber?: string | undefined;
  razorpayOrderId?: string | undefined;
  razorpayPaymentId?: string | undefined;
  razorpaySignature?: string | undefined;
  amount: number;
  currency: string;
  gateway?: string | undefined;
  paymentMethod?: string | undefined;
  status: PaymentStatus;
  failureReason?: string | undefined;
  cancelledAt?: string | undefined;
  paidAt?: string | undefined;
  verifiedAt?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface InvoiceLineItem {
  id?: string | undefined;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  number?: string | undefined; // backward compat with number
  clientId: string;
  clientUid?: string | undefined;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
  projectId?: string | undefined;
  projectName?: string | undefined;
  issueDate?: string | undefined;
  dueDate?: string | undefined;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate?: number | undefined; // e.g. 10 for 10%
  tax?: number | undefined;
  taxAmount?: number | undefined; // backward compat
  discount?: number | undefined;
  totalAmount: number;
  total?: number | undefined; // backward compat
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: InvoiceStatus;
  notes?: string | undefined;
  terms?: string | undefined;
  issuedAt?: string | undefined;
  dueAt?: string | undefined;
  sentAt?: string | undefined;
  paidAt?: string | undefined;
  cancelledAt?: string | undefined;
  cancelledBy?: string | undefined;
  cancellationReason?: string | undefined;
  createdByAdminUid?: string | undefined;
  createdByAdminName?: string | undefined;
  createdByAdminEmail?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
  documentPath?: string | undefined;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  uploadedBy: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  clientUid?: string | undefined;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
  projectId?: string | undefined;
  projectTitle?: string | undefined;
  name: string;
  fileName?: string | undefined;
  storagePath: string;
  downloadUrl?: string | undefined;
  contentType?: string | undefined;
  fileType?: string | undefined;
  sizeBytes?: number | undefined;
  visibility: "client" | "internal" | "public" | string;
  uploadedBy?: string | undefined;
  uploadedByEmail?: string | undefined;
  uploadedAt?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string | undefined;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  clientId: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderRole: "client" | "admin";
  recipientRole: "admin" | "client";
  text: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  adminUid?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  lastMessageText: string;
  lastMessageTimestamp: string;
  lastSenderRole: "client" | "admin";
  lastSenderUid: string;
  lastSenderName?: string;
  unreadCountClient: number;
  unreadCountAdmin: number;
  status?: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export type MeetingType = "Online Meeting" | "In-Person Meeting";
export type MeetingPlatform = "Google Meet" | "Microsoft Teams" | "In-Person";
export type MeetingStatus =
  "Pending" | "Approved" | "Rescheduled" | "Rejected" | "Completed" | "Cancelled";

export interface MeetingRequest {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string | undefined;
  projectId?: string | undefined;
  projectTitle?: string | undefined;
  title: string;
  purpose: string;
  meetingType: MeetingType;
  platform?: MeetingPlatform | undefined;
  meetingProvider?: string | undefined;
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string; // e.g. "14:00"
  scheduledAt?: string | undefined; // Confirmed or updated ISO string
  meetingUrl?: string | undefined; // For Online Meeting (Google Meet / Microsoft Teams)
  location?: string | undefined; // For In-Person Meeting (Studio or Client location)
  status: MeetingStatus;
  adminNotes?: string | undefined;
  rescheduleReason?: string | undefined;
  rejectionReason?: string | undefined;
  cancellationReason?: string | undefined;
  cancelledBy?: string | undefined;
  cancelledAt?: string | undefined;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type Meeting = MeetingRequest;

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string | undefined;
  read?: boolean | undefined;
  projectId?: string | undefined;
  readAt?: string | undefined;
  createdAt: string;
}

export interface VinoraUpdate {
  id: string;
  title: string;
  description: string;
  category: string;
  imagePath?: string | undefined;
  publishedAt: string;
  visibility: UpdateVisibility;
  audienceIds: string[];
  pinned: boolean;
  archived: boolean;
}

export interface Resource {
  id: string;
  title: string;
  summary: string;
  category: string;
  type: "guide" | "article" | "template" | "tool";
  slug: string;
  publishedAt: string;
}

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  problem: string;
  approach: string;
  services: string[];
  features: string[];
  technologies: string[];
  designNotes: string;
  result: string;
  coverPath?: string | undefined;
  publishedAt: string;
}

export type CanonicalReferralStatus =
  "Pending" | "Registered" | "Qualified" | "Rewarded" | "Cancelled";

export type ReferralStatus =
  | CanonicalReferralStatus
  | "pending"
  | "registered"
  | "qualified"
  | "rewarded"
  | "cancelled"
  | "rejected";

export type RewardType = "points" | "credit" | "discount" | "custom";
export type RewardStatus = "pending" | "approved" | "credited" | "cancelled";

export interface Referral {
  id: string;
  referralId?: string | undefined;
  referrerUid: string;
  referrerClientId?: string | undefined; // backward compat
  referrerName?: string | undefined;
  referrerEmail?: string | undefined;
  referredClientUid?: string | undefined;
  referredName?: string | undefined;
  referredEmail?: string | undefined;
  referralCode: string;
  code?: string | undefined; // backward compat
  status: ReferralStatus;
  rewardType?: RewardType | undefined;
  rewardAmount?: number | undefined;
  rewardCurrency?: string | undefined;
  rewardStatus?: RewardStatus | undefined;
  rewardDescription?: string | undefined;
  convertedProjectId?: string | undefined;
  cancellationReason?: string | undefined;
  cancelledBy?: string | undefined;
  cancelledAt?: string | undefined;
  registeredAt?: string | undefined;
  qualifiedAt?: string | undefined;
  rewardedAt?: string | undefined;
  completedAt?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface ClientReferralProfile {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  registeredCount: number;
  qualifiedCount: number;
  rewardedCount: number;
  rewardPoints: number;
  accountCredits: number;
  referredByCode?: string | undefined;
  referredByUid?: string | undefined;
}
