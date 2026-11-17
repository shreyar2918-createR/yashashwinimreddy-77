import { jsonSuccess } from "../utils/response";
import { getServerEnv } from "../config/env";
import { isFirebaseAdminInitialized } from "../config/firebase-admin";

export async function handleHealthRoute(request: Request): Promise<Response> {
  const env = getServerEnv();

  return jsonSuccess({
    status: "healthy",
    service: "VINORA Backend API Foundation",
    version: "1.0.0",
    environment: env.NODE_ENV,
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      databaseId: env.FIREBASE_DATABASE_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      adminInitialized: isFirebaseAdminInitialized(),
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
