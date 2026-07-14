import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load Firebase configuration
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Initialize Firebase App for Server-side
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Background Telemetry Logging Webhook Endpoint
  app.post("/api/telemetry", async (req, res) => {
    try {
      const { workspaceId, surveyId, questionId, payload, timestamp, type } = req.body;

      if (!workspaceId || !surveyId || !timestamp || !type) {
        return res.status(400).json({ 
          error: "Missing required fields: workspaceId, surveyId, timestamp, type" 
        });
      }

      // Log to Firestore under /telemetry
      const docRef = await addDoc(collection(db, "telemetry"), {
        workspaceId,
        surveyId,
        questionId: questionId || "",
        payload: payload || {},
        timestamp: Number(timestamp) || Date.now(),
        type
      });

      console.log(`[Telemetry Webhook] Saved telemetry log with ID: ${docRef.id} for survey ${surveyId}`);
      return res.json({ success: true, id: docRef.id });
    } catch (error: any) {
      console.error("[Telemetry Webhook] Error processing telemetry:", error);
      return res.status(500).json({ 
        error: error.message || "Failed to log telemetry background payload" 
      });
    }
  });

  // Configure Vite or Serve Built Files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start the full-stack server:", error);
});
