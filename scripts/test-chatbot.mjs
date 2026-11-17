import { processAiChatMessage } from "../server/services/aiChat.ts";

console.log("==================================================");
console.log("VINORA — Step 19: AI Chatbot System Verification");
console.log("==================================================");

async function runChatbotTests() {
  // Test 1: Empty input rejection
  console.log("1. Testing empty input handling...");
  const emptyRes = await processAiChatMessage("");
  if (emptyRes.reply && emptyRes.reply.includes("Please enter a message")) {
    console.log("   ✓ Confirmed: Empty user message returns polite prompt.");
  } else {
    throw new Error("FAILED: Empty message handling failed.");
  }

  // Test 2: Services Inquiry
  console.log("2. Testing services capability inquiry...");
  const servicesRes = await processAiChatMessage("What services does VINORA offer?");
  if (
    servicesRes.reply.toLowerCase().includes("web & application development") ||
    servicesRes.reply.toLowerCase().includes("bespoke architecture") ||
    servicesRes.reply.toLowerCase().includes("ai & machine learning")
  ) {
    console.log("   ✓ Confirmed: Chatbot answers services questions accurately.");
  } else {
    throw new Error("FAILED: Services inquiry test failed.");
  }

  // Test 3: Starting a Project Inquiry
  console.log("3. Testing starting a project inquiry...");
  const startRes = await processAiChatMessage("I want to start a new project with VINORA");
  if (
    startRes.reply.includes("/start-project") &&
    (startRes.reply.toLowerCase().includes("discovery") ||
      startRes.reply.toLowerCase().includes("proposal"))
  ) {
    console.log(
      "   ✓ Confirmed: Chatbot guides user to /start-project and explains proposal process.",
    );
  } else {
    throw new Error("FAILED: Starting project inquiry test failed.");
  }

  // Test 4: CRITICAL PRIVACY & ACCOUNT SECURITY GUARDRAIL (Requirement 6)
  console.log("4. Testing Critical Privacy Guardrail for Account-Specific Data...");
  const privateQueries = [
    "What is the status of my project and my invoice balance due?",
    "Check my invoice",
    "Show my payment status",
    "What are my private messages?",
  ];

  for (const q of privateQueries) {
    const privRes = await processAiChatMessage(q);
    const text = privRes.reply.toLowerCase();
    const hasGuardrail =
      text.includes("client portal") ||
      text.includes("/login?role=client") ||
      text.includes("privacy and security");

    if (hasGuardrail) {
      console.log(
        `   ✓ Confirmed: Private query "${q.slice(0, 35)}..." redirects to Client Portal.`,
      );
    } else {
      throw new Error(`FAILED: Privacy guardrail failed for query: "${q}"`);
    }
  }

  // Test 5: AI & Machine Learning Solutions
  console.log("5. Testing AI & Machine Learning solutions inquiry...");
  const aiRes = await processAiChatMessage("Tell me about your AI and machine learning solutions");
  if (
    aiRes.reply.toLowerCase().includes("llm") ||
    aiRes.reply.toLowerCase().includes("generative ai") ||
    aiRes.reply.toLowerCase().includes("machine learning")
  ) {
    console.log("   ✓ Confirmed: Chatbot articulates AI/ML architectural offerings.");
  } else {
    throw new Error("FAILED: AI/ML inquiry test failed.");
  }

  // Test 6: Project Process & Methodology
  console.log("6. Testing project process & methodology inquiry...");
  const processRes = await processAiChatMessage("How does VINORA work?");
  if (
    processRes.reply.toLowerCase().includes("discovery") ||
    processRes.reply.toLowerCase().includes("blueprint") ||
    processRes.reply.toLowerCase().includes("sprint")
  ) {
    console.log("   ✓ Confirmed: Chatbot details 5-phase delivery process.");
  } else {
    throw new Error("FAILED: Process inquiry test failed.");
  }

  // Test 7: Contact Information
  console.log("7. Testing contact inquiry...");
  const contactRes = await processAiChatMessage("How can I contact VINORA?");
  if (contactRes.reply.includes("/contact") || contactRes.reply.includes("contact@vinora.com")) {
    console.log("   ✓ Confirmed: Chatbot provides studio contact channels.");
  } else {
    throw new Error("FAILED: Contact inquiry test failed.");
  }

  // Test 8: Fallback for generic/unrecognized query
  console.log("8. Testing fallback for general/unclear query...");
  const fallbackRes = await processAiChatMessage("hello there xyz random query");
  if (fallbackRes.reply && fallbackRes.suggestions && fallbackRes.suggestions.length > 0) {
    console.log("   ✓ Confirmed: Unclear query returns polite fallback and suggested topics.");
  } else {
    throw new Error("FAILED: Fallback test failed.");
  }

  console.log("--------------------------------------------------");
  console.log("✓ All Step 19 AI Chatbot Invariants Verified Successfully!");
  console.log("==================================================");
}

runChatbotTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
