import { GoogleGenAI } from "@google/genai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  reply: string;
  suggestions?: string[];
  provider: "gemini" | "knowledge-engine";
}

const SYSTEM_INSTRUCTION = `
You are the official AI Studio Assistant for VINORA (https://vinora.studio).
VINORA is a premier digital strategy, architecture, and technology firm turning ideas into impact through disciplined engineering, bespoke design, and advanced software solutions.

Your tone:
- Professional, articulate, minimal, helpful, confident, and direct.
- Never use cheesy emojis or sales-pitch clichés. Keep responses concise and informative.

Knowledge Base:
1. Services:
   - UI/UX & Design Systems: Editorial typography, user journeys, interactive prototypes, design tokens, and production design libraries.
   - Web Development: High-performance React, TypeScript, TanStack, Next.js, and scalable full-stack applications.
   - Mobile/App Development: Cross-platform iOS/Android apps, progressive web applications (PWA), and responsive digital products.
   - AI & Machine Learning Solutions: LLM integrations, conversational agents, automated data intelligence, predictive workflows, and domain-specific AI tooling.
   - Bespoke Architecture & Cloud Systems: Scalable cloud infrastructure, serverless backends, robust database design (PostgreSQL/Firestore), and microservices.
   - Strategic Tech Consulting: Scoping workshops, code audits, architecture reviews, and sprint roadmap planning.

2. Project Process (5 Phases):
   - Phase 1: Discovery & Technical Scoping (clarifying goals, timeline, and tech stack).
   - Phase 2: Architectural Blueprint & Formal Proposal (detailed milestone breakdown, fixed/transparent quotes).
   - Phase 3: Agile Sprint Execution (iterative delivery with versioned milestones).
   - Phase 4: Quality Assurance, Security Audits & Deployment (rigorous performance and invariant testing).
   - Phase 5: Handover, Knowledge Transfer & Evolution (post-launch support and maintenance).

3. Proposals & Budget Breakdown:
   - Every proposal includes: Project Name, Client details, Project Description, Scope of Work, Deliverables, Estimated Timeline, Revision terms, and Terms & Conditions.
   - Detailed Project Budget Breakdown: Itemized line items with description and amount, subtotal, tax rate/tax, discount, and final project total.
   - Client Review: Clients can review all proposal details, request revisions with notes, or accept proposals directly in the Client Portal.

4. Payment Plans & Razorpay Integration:
   - Full Payment Plan: 100% full project cost settled upfront upon proposal acceptance.
   - Milestone Payment Plan: Project budget is distributed across phased milestones (e.g., 50% advance deposit / 50% upon final delivery, or custom milestone splits). Invoices are raised per milestone and settled sequentially.
   - Payment Methods: Seamless payments powered by Razorpay gateway supporting UPI, debit/credit cards, and corporate netbanking.
   - Invoices & Receipts: Itemized digital invoices, payment status tracking (Paid, Partially Paid, Pending), and immutable receipts stored 24/7 in the Client Portal.

5. Client Portal & Collaboration:
   - Central command center accessible at /client or /login?role=client.
   - Project Tracking: Real-time progress indicators, active sprint milestones, and deliverables status.
   - Documents Repository: Secure access to architecture blueprints, technical specifications, and project assets.
   - Direct Messaging: Real-time communication channel with your assigned project lead.
   - Meeting Scheduling: Book online video consultations or in-person reviews directly with the team.
   - Referrals: Invite peers to VINORA and earn milestone credits.

6. Starting a Project:
   - Visitors can begin immediately by submitting their project brief at /start-project.
   - Or schedule an initial consultation via /contact.

7. CRITICAL PRIVACY & ACCOUNT SECURITY RULE:
   - You are a public website assistant.
   - You DO NOT have access to private client accounts, specific invoice numbers, payment balances, personal project progression, or confidential team messages.
   - If a user asks for personal account data (e.g., "What is the status of my invoice?", "Check my project progress", "Show my payment receipt", "My messages"), you MUST politely inform them that account-specific information is protected and ask them to log in to their authenticated Client Portal at /login?role=client.

8. Contact Information:
   - Email: contact@vinora.com / studio@vinora.com
   - Direct Inquiry Form: /contact
   - Start Project Brief: /start-project
   - Client Portal: /login?role=client
`.trim();

/**
 * Intelligent domain-specific knowledge fallback engine.
 * Guarantees 100% reliable responses even if GEMINI_API_KEY is not configured or rate-limited.
 */
function queryKnowledgeEngine(userInput: string): { reply: string; suggestions?: string[] } {
  const q = userInput.toLowerCase().trim();

  // 1. Privacy & Account-Specific Information Guardrail
  if (
    q.includes("my project") ||
    q.includes("my invoice") ||
    q.includes("my payment") ||
    q.includes("my status") ||
    q.includes("my proposal") ||
    q.includes("my message") ||
    q.includes("check status of my") ||
    q.includes("balance due") ||
    q.includes("how much do i owe") ||
    q.includes("my account")
  ) {
    return {
      reply:
        "For your privacy and security, specific project milestones, invoice amounts, payment receipts, and communications are protected within the authenticated VINORA Client Portal.\n\nPlease sign in to your verified account at [/login?role=client](/login?role=client) to review your active deliverables, billing history, and project leads directly.",
      suggestions: [
        "Go to Client Portal Login",
        "What services do you offer?",
        "How do I start a project?",
        "Contact VINORA",
      ],
    };
  }

  // 2. Services Overview
  if (
    q === "our services" ||
    q === "services" ||
    q.includes("what services do you offer") ||
    q.includes("what do you do") ||
    q.includes("capabilities") ||
    q.includes("expertise") ||
    q.includes("stack")
  ) {
    return {
      reply:
        "VINORA delivers end-to-end digital engineering and strategic design:\n\n" +
        "• **UI/UX & Design Systems**: Editorial typography, user journeys, interactive prototypes, and production-grade component systems.\n" +
        "• **Web Development**: High-performance React, TypeScript, TanStack, and Next.js applications engineered for scale.\n" +
        "• **Mobile/App Development**: Cross-platform iOS/Android apps, progressive web apps (PWA), and reactive mobile interfaces.\n" +
        "• **AI & Machine Learning**: Custom LLM agents, automated data intelligence, predictive workflows, and domain tooling.\n" +
        "• **Bespoke Cloud Architecture**: Scalable serverless systems, resilient database architectures (PostgreSQL/Firestore), and microservices.\n" +
        "• **Strategic Consulting**: Technical discovery workshops, code audits, architecture reviews, and sprint planning.",
      suggestions: [
        "Start a Project",
        "Payment & Budget",
        "How It Works",
        "Client Portal",
        "Contact VINORA",
      ],
    };
  }

  // 3. UI/UX Design Specific
  if (
    q.includes("ui/ux") ||
    q.includes("ui") ||
    q.includes("ux") ||
    q.includes("design") ||
    q.includes("wireframe") ||
    q.includes("prototype")
  ) {
    return {
      reply:
        "VINORA's UI/UX practice combines editorial aesthetics with rigorous design systems:\n\n" +
        "• **Discovery & User Journeys**: Mapping intuitive user flows and information architecture.\n" +
        "• **Wireframing & Interactive Prototyping**: Fast iterative prototypes validating usability before engineering.\n" +
        "• **Editorial & Bespoke Visual Identity**: Monochrome minimalism, bold typography, micro-interactions, and responsive fidelity.\n" +
        "• **Production Design Systems**: Scalable design tokens and component libraries integrated directly with React/Tailwind.",
      suggestions: ["Start a Project", "Our Services", "Payment & Budget", "Contact VINORA"],
    };
  }

  // 4. Web Development Specific
  if (
    q.includes("web development") ||
    q.includes("web dev") ||
    q.includes("frontend") ||
    q.includes("full-stack") ||
    q.includes("fullstack") ||
    q.includes("react")
  ) {
    return {
      reply:
        "VINORA engineers production-grade web applications with uncompromising performance and reliability:\n\n" +
        "• **Modern Tech Stack**: React 19, TypeScript, TanStack Start/Router, Next.js, and Tailwind CSS.\n" +
        "• **Full-Stack Architecture**: Server-side rendering, resilient REST/RPC endpoints, and real-time database synchronization.\n" +
        "• **Quality & Testing**: Zero-regression builds, strict type safety, end-to-end integration tests, and lighthouse optimization.\n" +
        "• **Security**: Enterprise access control, authenticated sessions, and robust Firestore/SQL security rules.",
      suggestions: ["Start a Project", "Our Services", "How It Works", "Contact VINORA"],
    };
  }

  // 5. Mobile & App Development
  if (
    q.includes("mobile") ||
    q.includes("app development") ||
    q.includes("ios") ||
    q.includes("android") ||
    q.includes("pwa")
  ) {
    return {
      reply:
        "Our mobile engineering team develops fluid, high-performance mobile applications:\n\n" +
        "• **Cross-Platform Applications**: High-velocity React Native and hybrid native builds targeting iOS and Android with single-source logic.\n" +
        "• **Progressive Web Apps (PWA)**: Installable, offline-capable, and ultra-fast web apps that feel indistinguishable from native.\n" +
        "• **Native Device Integrations**: Biometrics, push notifications, offline syncing, and hardware acceleration.\n" +
        "• **App Store Readiness**: Complete packaging, compliance auditing, and App Store / Google Play deployment pipelines.",
      suggestions: ["Start a Project", "Our Services", "Payment & Budget", "Contact VINORA"],
    };
  }

  // 6. AI & Machine Learning
  if (
    q.includes("ai") ||
    q.includes("machine learning") ||
    q.includes("llm") ||
    q.includes("bot") ||
    q.includes("intelligence") ||
    q.includes("agent")
  ) {
    return {
      reply:
        "Our AI & Machine Learning practice engineers customized, privacy-conscious intelligent systems:\n\n" +
        "• **Generative AI & LLM Systems**: Domain-specific conversational agents, contextual search, and document intelligence.\n" +
        "• **Automated Workflow Pipelines**: Integrating AI into your existing data stores and operational tooling.\n" +
        "• **Enterprise Guardrails**: Localized validation, rate limiting, and data protection ensuring proprietary data remains private.\n\n" +
        "Would you like to explore how an AI system can be architected for your organization?",
      suggestions: ["Start a Project", "Our Services", "How It Works", "Contact VINORA"],
    };
  }

  // 7. Starting a Project
  if (
    q === "start a project" ||
    q.includes("start a project") ||
    q.includes("how to start a project") ||
    q.includes("new project") ||
    q.includes("hire") ||
    q.includes("quote") ||
    q.includes("get started")
  ) {
    return {
      reply:
        "Starting a project with VINORA is straightforward and transparent:\n\n" +
        "1. **Submit Your Brief**: Visit our [Start Project](/start-project) page to outline your goals, budget range, and timeline.\n" +
        "2. **Discovery Consultation**: We conduct an initial architecture consultation to examine feasibility and technical requirements.\n" +
        "3. **Formal Proposal & Budget**: We provide a comprehensive milestone-based proposal with fixed deliverables and timelines.\n" +
        "4. **Digital Sign-off & Kickoff**: Review and accept the proposal in the Client Portal to initiate sprint execution.",
      suggestions: ["Start a Project", "Payment & Budget", "Our Services", "How It Works"],
    };
  }

  // 8. Methodology & Project Process ("How It Works")
  if (
    q === "how it works" ||
    q.includes("how it works") ||
    q.includes("process") ||
    q.includes("development process") ||
    q.includes("how does vinora work") ||
    q.includes("how vinora works") ||
    q.includes("methodology") ||
    q.includes("workflow") ||
    q.includes("steps")
  ) {
    return {
      reply:
        "VINORA operates under a disciplined 5-phase engineering methodology:\n\n" +
        "1. **Discovery & Scoping**: Clarifying business goals, user personas, timeline, and architectural requirements.\n" +
        "2. **Architectural Blueprint & Proposal**: Detailed line-item budget, milestone payment plan, and formal deliverables.\n" +
        "3. **Agile Sprint Execution**: Iterative bi-weekly releases delivered directly to staging environments with continuous client visibility.\n" +
        "4. **Quality Assurance & Security Audits**: End-to-end testing, security rule validation, and performance benchmarks.\n" +
        "5. **Production Launch & Handover**: Zero-downtime deployment, immutable code repositories, and ongoing maintenance.",
      suggestions: ["Start a Project", "Payment & Budget", "Client Portal", "Contact VINORA"],
    };
  }

  // 9. Payment & Budget / Full Payment vs Milestone Payment
  if (
    q === "payment & budget" ||
    q.includes("payment & budget") ||
    q.includes("payment and budget") ||
    q.includes("budget") ||
    q.includes("payment plan") ||
    q.includes("full payment") ||
    q.includes("milestone payment") ||
    q.includes("full payment vs milestone") ||
    q.includes("payment process") ||
    q.includes("how does payment work") ||
    q.includes("how much") ||
    q.includes("pricing") ||
    q.includes("cost")
  ) {
    return {
      reply:
        "VINORA offers a structured, transparent budget and payment framework:\n\n" +
        "• **Itemized Budget Breakdown**: Every proposal features dynamic line items detailing exact deliverables (e.g. UI/UX Design, Frontend, Backend, QA) alongside subtotal, taxes, discounts, and final total.\n\n" +
        "• **Full Payment Plan**: 100% full project cost settled upfront upon proposal acceptance for expedited end-to-end delivery.\n\n" +
        "• **Milestone Payment Plan**: Budget is distributed across staged deliverables (e.g., 50% advance deposit / 50% on final handover, or custom milestones). Invoices are unlocked and settled as milestones are achieved.\n\n" +
        "• **Razorpay Gateway**: Fast, verified payments supporting UPI, debit/credit cards, and corporate netbanking with instant digital receipts.",
      suggestions: ["Start a Project", "How It Works", "Client Portal", "Contact VINORA"],
    };
  }

  // 10. Proposals
  if (
    q.includes("proposal") ||
    q.includes("proposals") ||
    q.includes("approval") ||
    q.includes("scope of work") ||
    q.includes("terms and conditions")
  ) {
    return {
      reply:
        "Every VINORA project begins with an official, transparent Proposal:\n\n" +
        "• **Scope & Deliverables**: Clear definition of work, features, estimated timelines, and revision policies.\n" +
        "• **Itemized Budget**: Dynamic breakdown of each deliverable with transparent line-item pricing.\n" +
        "• **Payment Plan**: Clear selection between 100% Full Payment or Milestone-based staged payments.\n" +
        "• **Client Portal Review**: Clients review the proposal, submit notes or revision requests, and digitally accept to begin work immediately.",
      suggestions: ["Payment & Budget", "Client Portal", "Start a Project", "Contact VINORA"],
    };
  }

  // 11. Client Portal & Project Tracking
  if (
    q === "client portal" ||
    q.includes("client portal") ||
    q.includes("portal") ||
    q.includes("track project") ||
    q.includes("project tracking") ||
    q.includes("tracking") ||
    q.includes("milestones") ||
    q.includes("status of project")
  ) {
    return {
      reply:
        "The VINORA Client Portal is your dedicated command center for real-time engagement:\n\n" +
        "• **Project Tracking**: Live sprint timeline, milestone completion percentages, and deliverable checklists.\n" +
        "• **Proposals & Digital Acceptance**: Review itemized budgets and accept proposals with digital sign-off.\n" +
        "• **Invoices & Billing**: View status (Paid, Pending, Overdue) and make instant payments via Razorpay.\n" +
        "• **Document Hub**: Access versioned architecture blueprints, code repositories, and contract files.\n" +
        "• **Direct Messaging & Meetings**: Live communication with your project lead and easy consultation booking.\n\n" +
        "Sign in to your account at [/login?role=client](/login?role=client).",
      suggestions: ["Client Portal Login", "Start a Project", "Payment & Budget", "Contact VINORA"],
    };
  }

  // 12. Documents & Files
  if (
    q.includes("document") ||
    q.includes("documents") ||
    q.includes("file") ||
    q.includes("blueprint") ||
    q.includes("specification") ||
    q.includes("download")
  ) {
    return {
      reply:
        "All project documentation is securely organized in the VINORA Client Portal:\n\n" +
        "• **Architecture Blueprints**: System schemas, API definitions, and technical specs.\n" +
        "• **Design Assets**: Exported wireframes, UI kits, and design system guidelines.\n" +
        "• **Contracts & Statements of Work**: Versioned proposals, agreements, and tax invoices.\n\n" +
        "Active clients can view and download all files anytime inside the [Client Portal](/login?role=client).",
      suggestions: ["Client Portal", "How It Works", "Start a Project", "Contact VINORA"],
    };
  }

  // 13. Invoices & Billing
  if (
    q.includes("invoice") ||
    q.includes("invoices") ||
    q.includes("receipt") ||
    q.includes("razorpay") ||
    q.includes("billing")
  ) {
    return {
      reply:
        "VINORA provides automated, compliant invoicing tied to verified project milestones:\n\n" +
        "• **Itemized Billing**: Invoices reflect exact project budget line items and payment terms.\n" +
        "• **Razorpay Checkout**: Pay with UPI, cards, and netbanking with instant transaction verification.\n" +
        "• **Status Tracking**: Live tracking of Paid, Partially Paid, and Pending balances in the Client Portal.\n" +
        "• **Receipts**: Downloadable tax-compliant PDF receipts generated automatically upon payment.",
      suggestions: ["Payment & Budget", "Client Portal", "Start a Project", "Contact VINORA"],
    };
  }

  // 14. Contact & Meetings
  if (
    q === "contact vinora" ||
    q.includes("contact vinora") ||
    q.includes("contact") ||
    q.includes("email") ||
    q.includes("phone") ||
    q.includes("reach") ||
    q.includes("meeting") ||
    q.includes("consultation") ||
    q.includes("schedule")
  ) {
    return {
      reply:
        "You can reach the VINORA studio team through multiple channels:\n\n" +
        "• **Online Form**: Submit an inquiry directly on our [Contact Page](/contact).\n" +
        "• **Direct Email**: [contact@vinora.com](mailto:contact@vinora.com) or [studio@vinora.com](mailto:studio@vinora.com)\n" +
        "• **Project Inquiries**: Submit your brief at [Start Project](/start-project) for a tailored estimate.\n" +
        "• **Meeting Scheduling**: Active and prospective clients can schedule Online or In-Person consultations.\n" +
        "• **Turnaround**: Our architecture leads review and respond to inquiries within 1 business day.",
      suggestions: ["Start a Project", "Our Services", "Payment & Budget", "Client Portal"],
    };
  }

  // 15. General / Fallback
  return {
    reply:
      "I am the VINORA AI Assistant. I can assist you with our software engineering services, UI/UX design, development process, proposals, full vs. milestone payments, project tracking, and Client Portal access.\n\n" +
      "How can I assist your team today?",
    suggestions: [
      "Start a Project",
      "Our Services",
      "How It Works",
      "Payment & Budget",
      "Client Portal",
      "Contact VINORA",
    ],
  };
}

/**
 * Dispatches a chat message to Gemini 3.8 Flash, or falls back to the
 * VINORA Knowledge Engine if GEMINI_API_KEY is not present or returns an error.
 */
export async function processAiChatMessage(
  message: string,
  history: ChatMessage[] = [],
): Promise<ChatResponse> {
  const cleanMessage = message.trim();
  if (!cleanMessage) {
    return {
      reply: "Please enter a message to begin our conversation.",
      provider: "knowledge-engine",
      suggestions: ["What services do you offer?", "I want to start a project"],
    };
  }

  // 1. Check Privacy & Account-Specific Information Guardrail FIRST
  // Protects user credentials and prevents leaking account queries to external LLMs
  const lowerMsg = cleanMessage.toLowerCase();
  if (
    lowerMsg.includes("my project") ||
    lowerMsg.includes("my invoice") ||
    lowerMsg.includes("my payment") ||
    lowerMsg.includes("my status") ||
    lowerMsg.includes("my proposal") ||
    lowerMsg.includes("my message") ||
    lowerMsg.includes("check status of my") ||
    lowerMsg.includes("balance due") ||
    lowerMsg.includes("how much do i owe") ||
    lowerMsg.includes("my account")
  ) {
    const privacyRes = queryKnowledgeEngine(cleanMessage);
    return {
      reply: privacyRes.reply,
      suggestions: privacyRes.suggestions,
      provider: "knowledge-engine",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // If Gemini API Key is available, attempt generative response with timeout guard
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Build conversation contents
      const conversationContents = [];

      // Format previous history (limit to last 6 messages for focus & speed)
      const recentHistory = history.slice(-6);
      for (const h of recentHistory) {
        if (h.role === "user" || h.role === "assistant") {
          conversationContents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          });
        }
      }

      // Add current user message
      conversationContents.push({
        role: "user",
        parts: [{ text: cleanMessage }],
      });

      let response;
      try {
        const generatePromise = ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: conversationContents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
            maxOutputTokens: 600,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI generation timed out")), 4000),
        );

        response = await Promise.race([generatePromise, timeoutPromise]);
      } catch (firstErr: unknown) {
        // If gemini-3.8-flash encounters quota exhaustion (resource_exhausted) or failure, try flash-lite
        console.warn(
          "[VINORA AI] Primary model (gemini-3.8-flash) rate-limited or error, attempting gemini-3.1-flash-lite:",
          firstErr,
        );
        try {
          const fallbackGenPromise = ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: conversationContents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.3,
              maxOutputTokens: 600,
            },
          });
          const fallbackTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Fallback AI timed out")), 3500),
          );
          response = await Promise.race([fallbackGenPromise, fallbackTimeout]);
        } catch (secondErr: unknown) {
          console.warn(
            "[VINORA AI] Secondary model also unavailable, falling back to Knowledge Engine:",
            secondErr,
          );
          response = null;
        }
      }

      const replyText = response?.text?.trim();
      if (replyText) {
        return {
          reply: replyText,
          suggestions: [
            "What services do you offer?",
            "I want to start a project",
            "How does VINORA work?",
            "Contact VINORA",
          ],
          provider: "gemini",
        };
      }
    } catch (err: unknown) {
      console.warn("[VINORA AI] Gemini API call fallback to Knowledge Engine:", err);
    }
  }

  // Graceful fallback to deterministic high-precision VINORA Knowledge Engine
  const fallback = queryKnowledgeEngine(cleanMessage);
  return {
    reply: fallback.reply,
    suggestions: fallback.suggestions,
    provider: "knowledge-engine",
  };
}
