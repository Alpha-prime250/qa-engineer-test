#!/usr/bin/env node
/**
 * Bug Verification Script
 * Confirms that all 3 intentional bugs are present in the codebase
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

console.log("🔍 Verifying bugs are present in the codebase...\n");

let bugsFound = 0;

// Bug A: Check payment.routes.js for amount.toString()
try {
  const paymentRoutesPath = join(projectRoot, "src/routes/payment.routes.js");
  const content = readFileSync(paymentRoutesPath, "utf-8");

  if (
    content.includes("amount: p.amount.toString()") ||
    content.includes("amount: payment.amount.toString()")
  ) {
    console.log("✅ Bug A found: amount.toString() in payment.routes.js");
    bugsFound++;
  } else {
    console.log(
      "❌ Bug A missing: amount should be converted to string (incorrectly)",
    );
  }
} catch (err) {
  console.log("⚠️  Bug A: Cannot verify (file not found?)");
}

// Bug B: Check payment.routes.js for missing max amount validation
try {
  const paymentRoutesPath = join(projectRoot, "src/routes/payment.routes.js");
  const content = readFileSync(paymentRoutesPath, "utf-8");

  // Look for actual if statement checking max amount (not in comments)
  // Match pattern: amount > 50000 or amount > MAX_AMOUNT as actual code
  const lines = content.split("\n");
  let hasActualMaxCheck = false;

  for (const line of lines) {
    // Skip comment lines
    if (line.trim().startsWith("//")) continue;
    // Check if line has actual validation code
    if (
      /if\s*\([^)]*amount\s*>\s*\d+/.test(line) ||
      /if\s*\([^)]*amount\s*<\s*\d+/.test(line)
    ) {
      hasActualMaxCheck = true;
      break;
    }
  }

  const hasBugComment = content.includes("BUG B:");
  const hasMinCheck = content.includes("amount <= 0");

  if (!hasActualMaxCheck && hasBugComment && hasMinCheck) {
    console.log("✅ Bug B found: Missing maximum amount validation");
    bugsFound++;
  } else if (hasActualMaxCheck) {
    console.log("❌ Bug B already fixed: Maximum amount check is present");
  } else {
    console.log("❌ Bug B missing: Should have validation bug");
  }
} catch (err) {
  console.log("⚠️  Bug B: Cannot verify (file not found?)");
}

// Bug D: Check webhook.routes.js for missing signature verification
try {
  const webhookRoutesPath = join(projectRoot, "src/routes/webhook.routes.js");
  const content = readFileSync(webhookRoutesPath, "utf-8");

  // Look for commented-out signature verification code
  const hasSignatureCheck =
    /if\s*\(\s*signature\s*!==\s*expectedSignature\s*\)/.test(content) &&
    !content.match(/\/\/.*if\s*\(\s*signature\s*!==\s*expectedSignature\s*\)/);
  const hasBugComment = content.includes("BUG D:");

  if (!hasSignatureCheck && hasBugComment) {
    console.log("✅ Bug D found: Missing webhook signature verification");
    bugsFound++;
  } else if (hasSignatureCheck) {
    console.log("❌ Bug D already fixed: Signature verification is present");
  } else {
    console.log("❌ Bug D missing: Should have webhook security bug");
  }
} catch (err) {
  console.log("⚠️  Bug D: Cannot verify (file not found?)");
}

// Bug E: Check webhook.routes.js for missing idempotency
try {
  const webhookRoutesPath = join(projectRoot, "src/routes/webhook.routes.js");
  const content = readFileSync(webhookRoutesPath, "utf-8");

  // Look for idempotency check
  const hasIdempotencyCheck =
    /processed_webhooks\.includes/.test(content) &&
    !content.match(/\/\/.*processed_webhooks\.includes/);
  const hasBugComment = content.includes("BUG E:");

  if (!hasIdempotencyCheck && hasBugComment) {
    console.log("✅ Bug E found: Missing webhook idempotency check");
    bugsFound++;
  } else if (hasIdempotencyCheck) {
    console.log("❌ Bug E already fixed: Idempotency check is present");
  } else {
    console.log("❌ Bug E missing: Should have idempotency bug");
  }
} catch (err) {
  console.log("⚠️  Bug E: Cannot verify (file not found?)");
}

// Bug F: Check table-order.routes.js for missing duplicate order check
try {
  const tableOrderPath = join(projectRoot, "src/routes/table-order.routes.js");
  const content = readFileSync(tableOrderPath, "utf-8");

  // Look for duplicate order check
  const hasDuplicateCheck =
    /existingOrder/.test(content) &&
    /status\s*===\s*['"]pending['"]/.test(content) &&
    !content.match(/\/\/.*existingOrder/);
  const hasBugComment = content.includes("BUG F:");

  if (!hasDuplicateCheck && hasBugComment) {
    console.log("✅ Bug F found: Missing duplicate table order prevention");
    bugsFound++;
  } else if (hasDuplicateCheck) {
    console.log("❌ Bug F already fixed: Duplicate check is present");
  } else {
    console.log("❌ Bug F missing: Should have duplicate order bug");
  }
} catch (err) {
  console.log("⚠️  Bug F: Cannot verify (file not found?)");
}

// Bug G: Check einvoice.routes.js for missing duplicate submission check
try {
  const einvoicePath = join(projectRoot, "src/routes/einvoice.routes.js");
  const content = readFileSync(einvoicePath, "utf-8");

  // Look for duplicate submission check
  const hasDuplicateSubmissionCheck =
    /einvoice_status.*submitted/.test(content) &&
    /einvoice_status.*accepted/.test(content) &&
    !content.match(/\/\/.*if.*einvoice_status/);
  const hasBugComment = content.includes("BUG G:");

  if (!hasDuplicateSubmissionCheck && hasBugComment) {
    console.log("✅ Bug G found: Missing duplicate e-invoice submission check");
    bugsFound++;
  } else if (hasDuplicateSubmissionCheck) {
    console.log(
      "❌ Bug G already fixed: Duplicate submission check is present",
    );
  } else {
    console.log("❌ Bug G missing: Should have duplicate submission bug");
  }
} catch (err) {
  console.log("⚠️  Bug G: Cannot verify (file not found?)");
}

// Bug C: Check auth.routes.js for email validation regex
try {
  const authRoutesPath = join(projectRoot, "src/routes/auth.routes.js");
  const content = readFileSync(authRoutesPath, "utf-8");

  // Look for the buggy regex that doesn't require TLD
  if (
    content.includes("/^[^\\s@]+@[^\\s@]+$/") ||
    content.includes("/^[^s@]+@[^s@]+$/")
  ) {
    console.log("✅ Bug C found: Email validation regex too permissive");
    bugsFound++;
  } else {
    console.log("❌ Bug C missing: Email regex should be permissive (buggy)");
  }
} catch (err) {
  console.log("⚠️  Bug C: Cannot verify (file not found?)");
}

console.log(`\n📊 Bugs found: ${bugsFound}/7`);

if (bugsFound === 7) {
  console.log("\n✅ All bugs are present! Repository is ready for candidates.");
  process.exit(0);
} else {
  console.log("\n⚠️  Some bugs are missing. Please check the code.");
  process.exit(1);
}
