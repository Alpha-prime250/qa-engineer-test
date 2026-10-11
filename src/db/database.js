import bcrypt from "bcryptjs";

// Simple in-memory database for testing
// In a real app, this would be PostgreSQL/MySQL

export const db = {
  users: [],
  payments: [],
  sessions: [],
  table_orders: [],
  invoices: [],
  processed_webhooks: [],
};

// Seed some test data
export function initDatabase() {
  // Reset so calling it twice (restart / tests) never duplicates seed data
  for (const key of Object.keys(db)) db[key] = [];

  // Create a test merchant
  db.users.push({
    id: "1",
    email: "merchant@test.com",
    // Extra finding: the previously hard-coded hash was not a valid bcrypt hash of
    // "Test123!", so the documented test login always failed. Hash at seed time.
    password: bcrypt.hashSync("Test123!", 10), // password: Test123!
    business_name: "Test Merchant",
    type: "merchant",
    created_at: new Date(),
  });

  // Create some test payments
  db.payments.push({
    id: "1",
    merchant_id: "1",
    amount: 25.5,
    currency: "EUR",
    status: "completed",
    customer_email: "customer1@test.com",
    created_at: new Date(),
  });

  db.payments.push({
    id: "2",
    merchant_id: "1",
    amount: 100.0,
    currency: "EUR",
    status: "pending",
    customer_email: "customer2@test.com",
    created_at: new Date(),
  });

  console.log("📊 Database initialized with test data");
}

// Helper to find user by email
export function findUserByEmail(email) {
  // Case-insensitive lookup (emails are stored lower-cased)
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : email;
  return db.users.find((u) => u.email === normalized);
}

// Helper to find user by ID
export function findUserById(id) {
  return db.users.find((u) => u.id === id);
}

// Helper to create user
export function createUser(userData) {
  const newUser = {
    id: String(db.users.length + 1),
    ...userData,
    created_at: new Date(),
  };
  db.users.push(newUser);
  return newUser;
}

// Helper to create payment
export function createPayment(paymentData) {
  const newPayment = {
    id: String(db.payments.length + 1),
    status: "pending",
    ...paymentData,
    created_at: new Date(),
  };
  db.payments.push(newPayment);
  return newPayment;
}

// Helper to get payments
export function getPayments(merchantId) {
  return db.payments.filter((p) => p.merchant_id === merchantId);
}

// Helper to get payment by ID
export function getPaymentById(id) {
  return db.payments.find((p) => p.id === id);
}
