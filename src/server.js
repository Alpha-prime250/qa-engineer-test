import { createApp } from "./app.js";

const PORT = process.env.PORT || 3000;
const { app, httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`✅ EU Pay QA Test API running on http://localhost:${PORT}`);
  console.log(`📖 Visit http://localhost:${PORT} for available endpoints`);
  console.log(`🔌 Socket.IO ready for real-time updates`);
});

export default app;
