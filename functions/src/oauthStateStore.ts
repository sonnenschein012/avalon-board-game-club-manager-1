import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export interface OAuthStateData {
  state: string;
  callerEmail: string;
  mode: 'connect' | 'reconnect' | 'change';
  createdAt: number;
  expiresAt: number;
}

const OAUTH_STATES_COLLECTION = '_private_oauth_states';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class OAuthStateStore {
  constructor(private db: admin.firestore.Firestore) {}

  /**
   * Generates and securely stores a single-use CSRF state token tied to caller email.
   */
  async generateAndSaveState(
    callerEmail: string,
    mode: 'connect' | 'reconnect' | 'change' = 'connect'
  ): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    const stateData: OAuthStateData = {
      state,
      callerEmail: callerEmail.trim().toLowerCase(),
      mode,
      createdAt: now,
      expiresAt: now + STATE_TTL_MS,
    };

    await this.db.collection(OAUTH_STATES_COLLECTION).doc(state).set(stateData);
    return state;
  }

  /**
   * Atomically validates and consumes (deletes) the CSRF state token inside a Firestore transaction.
   * Guarantees exact once execution even under concurrent requests.
   */
  async validateAndConsumeState(
    state: string,
    callerEmail: string
  ): Promise<{ valid: boolean; mode: 'connect' | 'reconnect' | 'change' }> {
    if (!state) {
      return { valid: false, mode: 'connect' };
    }

    const docRef = this.db.collection(OAUTH_STATES_COLLECTION).doc(state);
    const normalizedEmail = callerEmail.trim().toLowerCase();

    try {
      return await this.db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);

        if (!snap.exists) {
          return { valid: false, mode: 'connect' as const };
        }

        const data = snap.data() as OAuthStateData;

        // Atomically delete the state document to prevent any concurrent reuse
        transaction.delete(docRef);

        // Check expiration
        if (Date.now() > data.expiresAt) {
          return { valid: false, mode: data.mode };
        }

        // Check caller email binding
        if (data.callerEmail !== normalizedEmail) {
          return { valid: false, mode: data.mode };
        }

        return { valid: true, mode: data.mode };
      });
    } catch (error) {
      console.error('Transaction error in validateAndConsumeState:', error);
      return { valid: false, mode: 'connect' };
    }
  }
}
