# EU Pay QA Engineer Test Assignment

Welcome to the EU Pay QA Engineer technical assessment! This is a real-world payment API with **7 intentional bugs** for you to find, fix, and test.

---

## 🎯 Your Mission

As a QA Engineer at EU Pay, you'll test and fix bugs in a payment processing API that includes:

- **Authentication** (JWT-based)
- **Payment Processing** (similar to Stripe/Powens)
- **Webhook Handling** (payment status updates)
- **Table Orders** (real-time with Socket.IO)
- **E-Invoicing** (tax authority integration)

Your task:

1. **Find the bugs** through comprehensive testing
2. **Fix the bugs** with production-quality code
3. **Write tests** to prevent regression
4. **Document** your findings professionally

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** installed ([Download here](https://nodejs.org/))
- **Postman** or **curl** for API testing
- **Code editor** (VS Code recommended)

### Setup (< 2 minutes)

```bash
# Clone this repository
git clone https://github.com/European-pay/qa-engineer-test.git
cd qa-engineer-test

# Install dependencies
npm install

# Start the server
npm start
```

You should see:

```
📊 Database initialized with test data
✅ EU Pay QA Test API running on http://localhost:3000
📖 Visit http://localhost:3000 for available endpoints
🔌 Socket.IO ready for real-time updates
```

**Test it works:**

```bash
curl http://localhost:3000
```

---

## 📡 API Endpoints

Visit `http://localhost:3000` to see all available endpoints.

### Authentication

```
POST /api/auth/register    Register new merchant
POST /api/auth/login       Login and get JWT token
```

### Payments (requires JWT)

```
GET  /api/payments         List all payments
GET  /api/payments/:id     Get single payment
POST /api/payments         Create new payment
```

### Webhooks (no auth)

```
POST /api/webhooks/payment-status    Payment provider webhook
POST /api/webhooks/e-invoice         Tax authority webhook
```

### Table Orders (Socket.IO + REST)

```
GET   /api/table-orders              List orders
POST  /api/table-orders              Create order
PATCH /api/table-orders/:id/status   Update order status
```

### E-Invoicing (requires JWT)

```
POST /api/einvoice/submit            Submit invoice to tax authority
GET  /api/einvoice/status/:id        Check submission status
```

### Socket.IO Events

```
join_merchant              Join merchant room for updates
join_table                 Join table room for order updates
new_order                  Emitted when order created
order_status_changed       Emitted when status updated
```

---

## 🐛 The 7 Bugs

There are **7 intentional bugs** in this codebase across different components:

### Foundational Bugs (Find These First)

| Bug   | Component   | Severity | Location                       | Hint                      |
| ----- | ----------- | -------- | ------------------------------ | ------------------------- |
| **A** | Payment API | Medium   | `src/routes/payment.routes.js` | Check response data types |
| **B** | Payment API | High     | `src/routes/payment.routes.js` | Try €999,999,999          |
| **C** | Auth API    | Medium   | `src/routes/auth.routes.js`    | Try `user@domain`         |

### Advanced Bugs (For Strong Candidates)

| Bug   | Component    | Severity | Location                           | Hint                             |
| ----- | ------------ | -------- | ---------------------------------- | -------------------------------- |
| **D** | Webhooks     | Critical | `src/routes/webhook.routes.js`     | Security: signature verification |
| **E** | Webhooks     | High     | `src/routes/webhook.routes.js`     | What if webhook arrives twice?   |
| **F** | Table Orders | Medium   | `src/routes/table-order.routes.js` | Duplicate table orders           |
| **G** | E-Invoice    | Medium   | `src/routes/einvoice.routes.js`    | Duplicate submissions            |

---

## ✅ Your Tasks

### Task 1: Bug Hunting (1.5 hours)

Test the API systematically and find all 7 bugs.

**Minimum Requirements:**

- Find at least **5 out of 7 bugs** (Bugs A-E are must-find)
- Test with Postman/curl — don't just read code
- Document each bug with reproduction steps

**Testing Approach:**

1. **Happy Path Testing** — Test normal flows
2. **Negative Testing** — Invalid inputs, missing fields
3. **Security Testing** — SQL injection, XSS, signature spoofing
4. **Edge Case Testing** — Zero amounts, huge numbers, special characters
5. **Concurrency Testing** — Duplicate webhooks, simultaneous orders
6. **Integration Testing** — Webhook → Payment status update flow

**Deliverable:** `bug-reports.md`

**Format:**

```markdown
## Bug A: [Brief Title]

**Location:** src/routes/[file].js (approx line X)  
**Severity:** Critical / High / Medium / Low  
**Component:** Payment API / Webhooks / Table Orders / E-Invoice / Auth

**How to Reproduce:**

1. Start server: `npm start`
2. Login: `POST /api/auth/login` with `{"email":"merchant@test.com","password":"Test123!"}`
3. Send request: `GET /api/payments` with JWT token
4. Observe response...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens - be specific]

**Impact:**
[Why this is a problem in production]

**Root Cause:**
[Your technical analysis - which line, what's wrong]

**Suggested Fix:**
[Brief code-level suggestion]
```

---

### Task 2: Bug Fixing (2 hours)

Fix all bugs you found with production-quality code.

**Requirements:**

- Fix at least **5 bugs** (all required)
- Code must be clean and maintainable
- Follow existing code style
- Add comments explaining your fix
- No breaking changes to API contracts

**Deliverable:** Fixed code files + `fixes.md`

**Format:**

```markdown
## Fix 1: Payment Amount Data Type

**Bug:** Amount returned as string instead of number

**Files Changed:**

- src/routes/payment.routes.js (lines 18, 41)

**Code Changes:**
\`\`\`diff

- amount: p.amount.toString(),

* amount: parseFloat(p.amount),
  \`\`\`

**Why This Fix:**
Frontend JavaScript calculations require numeric types. Strings cause
NaN errors and incorrect math operations. parseFloat() maintains
precision for currency values.

**Testing:**
\`\`\`bash
curl http://localhost:3000/api/payments

# Response: amount is now numeric type

\`\`\`
```

---

### Task 3: Test Writing (1.5 hours)

Write comprehensive tests to prevent these bugs from recurring.

**Requirements:**

- Minimum **10 tests** covering all 7 bugs
- Use Node.js built-in test runner (already configured)
- Tests must be runnable with `npm test`
- Cover happy path, negative cases, and edge cases

**Test Files:**

```
src/routes/__tests__/auth.routes.test.js
src/routes/__tests__/payment.routes.test.js
src/routes/__tests__/webhook.routes.test.js
src/routes/__tests__/table-order.routes.test.js
src/routes/__tests__/einvoice.routes.test.js
```

**Example Test:**

```javascript
import { test } from "node:test";
import assert from "node:assert";

test("Bug A: GET /payments should return amount as number", async () => {
  // Arrange
  const token = await loginAndGetToken();

  // Act
  const response = await fetch("http://localhost:3000/api/payments", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  // Assert
  assert.strictEqual(response.status, 200);
  assert.strictEqual(typeof data.data[0].amount, "number");
  assert.strictEqual(data.data[0].amount, 25.5);
});

test("Bug B: POST /payments should reject amount over €50,000", async () => {
  const token = await loginAndGetToken();

  const response = await fetch("http://localhost:3000/api/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 999999,
      currency: "EUR",
      customer_email: "test@test.com",
    }),
  });

  assert.strictEqual(response.status, 400);
  const data = await response.json();
  assert.ok(data.error.includes("maximum"));
});
```

**Run tests:**

```bash
npm test
```

---

### Task 4: Test Plan Document (30 minutes)

Write a comprehensive test plan for the **Webhook Payment Flow**.

**Deliverable:** `test-plan.md`

**Include:**

**1. Test Scope**

- What will be tested (payment webhook flow end-to-end)
- What won't be tested (UI, performance, load testing)

**2. Test Environment**

- API: localhost:3000
- Webhook simulator: curl/Postman
- Database: In-memory (resets on restart)

**3. Test Scenarios** (minimum 12):

- ✅ Valid webhook with correct signature
- ✅ Webhook with invalid signature (should reject)
- ✅ Duplicate webhook (same event_id twice)
- ✅ Webhook for non-existent payment
- ✅ Webhook arrives before payment created
- ✅ Multiple webhooks for same payment (different statuses)
- ✅ Webhook with missing fields
- ✅ Webhook with malformed JSON
- ✅ Concurrent webhooks (race condition)
- ✅ Webhook with SQL injection attempt in payment_id
- ✅ Webhook signature timing attack
- ✅ Webhook replay attack (old event_id)

**4. Security Tests**

- Signature verification (HMAC-SHA256)
- Replay attack prevention
- SQL injection in webhook payload
- XSS in status field

**5. Edge Cases**

- Very large payment_id
- Unicode characters in status
- Null/empty event_id
- Future timestamps

**6. Integration Tests**

- Webhook → Payment status update → Database persistence
- Webhook → Socket.IO event emission
- Failed webhook → Retry logic (if implemented)

**7. Risk Assessment**

- What could go wrong in production?
- How would you detect it?
- How would you mitigate it?

---

## 📨 Submission

### What to Submit

1. ✅ `bug-reports.md` — All bugs documented
2. ✅ `fixes.md` — How you fixed each bug
3. ✅ `test-plan.md` — Webhook testing strategy
4. ✅ **Fixed code files** (with your changes)
5. ✅ **Test files** (with your tests)
6. ✅ **README-SUBMISSION.md** — Brief summary of your approach (3-5 sentences)

### How to Submit

**Option 1: Pull Request (Preferred)**

```bash
# Fork this repo first, then:
git checkout -b submission/your-name
git add .
git commit -m "QA assignment submission - [Your Name]"
git push origin submission/your-name
# Create Pull Request on GitHub
```

**Option 2: ZIP File**

```bash
# Create ZIP (exclude node_modules)
zip -r qa-submission-yourname.zip . -x "node_modules/*" ".git/*"

# Email to: careers@european-pay.eu
# Subject: QA Engineer Assignment - [Your Name]
```

---

## 📋 Evaluation Criteria

| Criteria      | Weight | What We Look For                                           |
| ------------- | ------ | ---------------------------------------------------------- |
| Bug Finding   | 25%    | Found 5-7 bugs? Clear reproduction? Correct severity?      |
| Bug Fixing    | 30%    | All bugs fixed correctly? Clean code? No breaking changes? |
| Test Coverage | 25%    | 10+ tests? Good coverage? Tests pass?                      |
| Documentation | 15%    | Professional? Clear? Well-structured?                      |
| Test Plan     | 5%     | Comprehensive? Realistic? Security-aware?                  |

**Passing Score:** 75%  
**Strong Candidate:** 85%+

---

## 💡 Tips for Success

### Do This ✅

- **Actually test the API** — Use Postman/curl, don't just read code
- **Think like an attacker** — Test security vulnerabilities
- **Test edge cases** — What breaks it?
- **Write clear docs** — We evaluate communication skills
- **Test your fixes** — Run `npm test` before submitting
- **Follow existing patterns** — Match the codebase style

### Don't Do This ❌

- ❌ Only test happy paths — We want edge cases and security tests
- ❌ Just read code — Actually run the API and test it
- ❌ Skip the tests — We want to see you can write them
- ❌ Copy-paste fixes from AI without understanding
- ❌ Take more than 8 hours — If stuck, submit what you have
- ❌ Change API contracts — Keep existing endpoint behavior

---

## 🔧 Testing Tools

### Postman Collection

Import `postman-collection.json` for pre-configured requests.

### curl Examples

**Register:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@merchant.com","password":"SecurePass123!","business_name":"Test Co"}'
```

**Login:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@test.com","password":"Test123!"}'
```

**Get Payments (with JWT):**

```bash
curl http://localhost:3000/api/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Test Webhook:**

```bash
curl -X POST http://localhost:3000/api/webhooks/payment-status \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: fake-signature" \
  -d '{"payment_id":"1","status":"completed","event_id":"evt_123"}'
```

**Test Socket.IO:**
Use [Socket.IO Client Tool](https://amritb.github.io/socketio-client-tool/) or write a simple HTML file:

```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<script>
  const socket = io("http://localhost:3000");
  socket.emit("join_table", 5);
  socket.on("order_status_changed", (data) => console.log(data));
</script>
```

---

## 🆘 Need Help?

### Technical Issues

**Port 3000 already in use:**

```bash
PORT=3001 npm start
```

**Dependencies won't install:**

```bash
rm -rf node_modules package-lock.json
npm install
```

**Node version too old:**

```bash
node --version  # Should be 20+
# Download latest: https://nodejs.org/
```

### Assignment Questions

Email: **tech-hiring@european-pay.eu**  
Subject: `[QA Assignment] Your Question`  
Response time: Within 24 hours (weekdays)

**We'll answer:**

- ✅ Technical setup issues
- ✅ Clarification on requirements
- ✅ Bugs in the assignment itself

**We won't answer:**

- ❌ "What are the bugs?" — That's what you need to find!
- ❌ "Is this the right fix?" — Use your judgment
- ❌ "Can you extend the deadline?" — Only in emergencies

---

## 📖 About EU Pay

EU Pay is a fintech company building payment solutions for European merchants and consumers.

**Tech Stack:**

- **Backend:** Node.js, Express, PostgreSQL, Redis
- **Mobile:** Flutter (iOS + Android)
- **Web:** Next.js 14, TypeScript
- **Cloud:** AWS (ECS, RDS, ElastiCache, SQS)
- **Payment Providers:** Powens (AIS + PIS), Bridge
- **E-Invoicing:** Seqino PDP

**What You'll Work On:**

- Testing payment flows before production
- Finding bugs in Flutter mobile apps and Node.js APIs
- Writing automated tests for critical payment paths
- Testing webhook integrations (Powens, Apple, Google)
- E-invoice submission testing (French tax authority)
- Real-time features (Socket.IO table orders)

This assignment mirrors **real work you'll do** at EU Pay!

---

## 🚫 What NOT to Do

- ❌ **Don't spend 20 hours** — This is a 5-6 hour assessment
- ❌ **Don't rewrite everything** — Fix bugs, don't refactor
- ❌ **Don't use AI to generate all code** — We'll know in the interview
- ❌ **Don't submit without testing** — Run `npm test` first
- ❌ **Don't plagiarize** — We check GitHub for copied solutions
- ❌ **Don't skip documentation** — Communication matters

---

## ✅ Pre-Submission Checklist

Before you submit, verify:

- [ ] All 7 bugs documented in `bug-reports.md`
- [ ] At least 5 bugs fixed in code
- [ ] At least 10 tests written
- [ ] All tests pass: `npm test`
- [ ] Bug verification script output reviewed: `npm run verify-bugs`
- [ ] `test-plan.md` is comprehensive
- [ ] `fixes.md` explains each fix
- [ ] `README-SUBMISSION.md` summarizes approach
- [ ] Code is clean and readable
- [ ] No `console.log` left in production code
- [ ] Server starts without errors: `npm start`

---

**Good luck! We're excited to see your work.** 🚀

Show us you can:

- 🔍 Find bugs through systematic testing
- 🛠️ Fix bugs with production-quality code
- ✅ Write tests that prevent regression
- 📝 Communicate clearly and professionally

---

**Questions?** Email tech-hiring@european-pay.eu

**Repository:** https://github.com/European-pay/qa-engineer-test
