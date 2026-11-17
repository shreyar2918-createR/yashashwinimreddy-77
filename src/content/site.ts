export const BRAND = {
  name: "VINORA",
  tagline: "Ideas today. Impact tomorrow.",
  positioning:
    "VINORA turns ideas and requirements into real digital solutions through strategy, design, technology and development.",
} as const;

export const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Services", to: "/#services" },
  { label: "Our Work", to: "/projects" },
  { label: "Contact", to: "/contact" },
] as const;

export const JOURNEY = [
  { step: "Idea", copy: "It starts with what you want to exist." },
  { step: "Understand", copy: "We listen and ask the right questions." },
  { step: "Plan", copy: "The idea becomes a defined scope." },
  { step: "Design", copy: "Structure, interface and brand take shape." },
  { step: "Build", copy: "Engineering, integration and testing." },
  { step: "Launch", copy: "Release, hand-over and documentation." },
  { step: "Grow", copy: "Improvement, support and next steps." },
] as const;

export const IDEA_STEPS = [
  {
    n: "01",
    title: "Tell Us Your Idea",
    copy: "In your own words. No technical vocabulary required.",
  },
  {
    n: "02",
    title: "We Understand",
    copy: "We study the intent, the audience and the constraints.",
  },
  { n: "03", title: "We Structure", copy: "The idea is broken into a clear, workable shape." },
  {
    n: "04",
    title: "We Identify What Is Needed",
    copy: "Strategy, brand, product, technology or growth — only what applies.",
  },
  {
    n: "05",
    title: "We Prepare the Next Steps",
    copy: "Scope, sequence, timeline and cost are written down.",
  },
  {
    n: "06",
    title: "You Decide Whether to Proceed",
    copy: "No obligation. The plan is yours either way.",
  },
] as const;

export type SolutionGlyph = "strategy" | "brand" | "product" | "technology" | "growth";

export interface SolutionCategory {
  id: string;
  title: string;
  intro: string;
  glyph: SolutionGlyph;
  items: string[];
}

export const SOLUTION_CATEGORIES: SolutionCategory[] = [
  {
    id: "start-strategy",
    glyph: "strategy",
    title: "Start & Strategy",
    intro: "Turn an intention into a plan that can actually be executed.",
    items: [
      "Startup idea planning",
      "Business planning",
      "Product planning",
      "Project strategy",
      "Technical consultation",
      "Pitch deck preparation",
    ],
  },
  {
    id: "brand-creative",
    glyph: "brand",
    title: "Brand & Creative",
    intro: "A consistent identity across everything people see.",
    items: [
      "Logo design",
      "Brand identity",
      "Posters",
      "Banners",
      "Social media creatives",
      "Portfolio design",
      "Presentation design",
    ],
  },
  {
    id: "digital-products",
    glyph: "product",
    title: "Digital Products",
    intro: "Websites, applications and software built to be used.",
    items: [
      "Business websites",
      "Portfolio websites",
      "E-commerce websites",
      "Landing pages",
      "Mobile applications",
      "UI/UX design",
      "Custom software",
    ],
  },
  {
    id: "ai-technology",
    glyph: "technology",
    title: "AI & Technology",
    intro: "Practical automation and intelligence, applied where it pays off.",
    items: [
      "AI solutions",
      "AI chatbots",
      "Automation",
      "API integration",
      "Technical consulting",
      "Technical training",
    ],
  },
  {
    id: "growth",
    glyph: "growth",
    title: "Growth",
    intro: "Keep what is built visible, healthy and improving.",
    items: ["SEO", "Digital marketing", "Website maintenance", "Analytics", "Digital strategy"],
  },
];

export const PROCESS_STEPS = [
  { n: "01", title: "Tell Us", copy: "Submit your project requirements." },
  { n: "02", title: "We Understand", copy: "VINORA reviews your requirement." },
  { n: "03", title: "Discuss", copy: "Clarify requirements if necessary." },
  { n: "04", title: "Proposal", copy: "Scope, timeline and pricing are prepared." },
  { n: "05", title: "Begin", copy: "After approval and required payment, work begins." },
  { n: "06", title: "Build", copy: "Design, development and testing." },
  { n: "07", title: "Review", copy: "Client reviews the work." },
  { n: "08", title: "Deliver", copy: "Final agreed deliverables are handed over." },
] as const;

export const WHY_VINORA = [
  {
    title: "You don't need to know the service",
    copy: "Bring the problem or the idea. Identifying what is actually needed is our job, not yours.",
  },
  {
    title: "One point of responsibility",
    copy: "VINORA understands the requirement and coordinates the expertise required to deliver it.",
  },
  {
    title: "Written scope before work",
    copy: "Scope, timeline and pricing are agreed in a proposal before anything is built.",
  },
  {
    title: "Visibility while we build",
    copy: "A client portal for progress, files, proposals, invoices and messages on your project.",
  },
] as const;

export const RESOURCE_CATEGORIES = [
  { title: "Business guides", copy: "Practical guidance for planning and running a venture." },
  { title: "Startup resources", copy: "Material for turning an early idea into a first version." },
  { title: "Design resources", copy: "References and systems for brand and interface work." },
  {
    title: "Technical articles",
    copy: "Engineering notes on how things are built and integrated.",
  },
  { title: "Templates", copy: "Reusable documents and starting points." },
  { title: "Tools", copy: "Small utilities that remove repetitive work." },
] as const;

export const PLANNED_TOOLS = [
  "Business Name Generator",
  "Startup Idea Evaluator",
  "QR Generator",
  "Invoice Generator",
  "Color Palette Generator",
  "Presentation Resources",
  "AI Tools",
] as const;

/**
 * Business contact details are intentionally unset. Nothing is invented here —
 * these are filled in once VINORA supplies the real information.
 */
export const CONTACT_DETAILS = {
  email: "vinora.techofficial@gmail.com",
  instagramHandle: "@vinora.tech",
  linkedinName: "VINORA",
  social: [
    { label: "LinkedIn", detail: "VINORA", href: "https://www.linkedin.com" },
    { label: "Instagram", detail: "@vinora.tech", href: "https://www.instagram.com/vinora.tech" },
  ],
};
