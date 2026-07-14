import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function reportTelemetry(event: {
  surveyId: string;
  questionId?: string;
  type: 'error' | 'submit_attempt' | 'save_progress_error' | 'other';
  payload: any;
}) {
  const workspaceId = "d5aa7b3b-8e9c-4d87-91d2-73d8f0822c0c";
  const telemetryData = {
    workspaceId,
    surveyId: event.surveyId,
    questionId: event.questionId || "",
    payload: event.payload || {},
    timestamp: Date.now(),
    type: event.type
  };

  // 1. Silent webhook request (in background)
  try {
    fetch("/api/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(telemetryData)
    }).then(res => {
      if (!res.ok) {
        console.warn("[Telemetry Webhook] Server returned status", res.status);
      }
    }).catch(e => {
      console.warn("[Telemetry Webhook] Network/fetch error", e);
    });
  } catch (err) {
    console.warn("[Telemetry Webhook] Failed to initiate webhook request", err);
  }

  // 2. Direct client-side write to Firestore as backup/guarantee
  try {
    await addDoc(collection(db, "telemetry"), telemetryData);
  } catch (err) {
    console.error("[Telemetry Firestore Backup] Failed direct write", err);
  }
}
