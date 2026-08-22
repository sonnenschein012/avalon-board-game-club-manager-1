import * as admin from 'firebase-admin';

export interface PrivateGoogleIntegrationData {
  refreshToken: string;
  connectedEmail: string | null;
  updatedAt: admin.firestore.FieldValue | string;
  updatedBy: string;
  scopes: string[];
}

export interface PublicGoogleIntegrationData {
  state: 'connected' | 'reauth_required' | 'disconnected';
  connectedEmail: string | null;
  connectedAt: admin.firestore.FieldValue | string | null;
  lastVerifiedAt: admin.firestore.FieldValue | string | null;
  templateFormId?: string | null;
  templateFormTitle?: string | null;
}

const PRIVATE_INTEGRATION_COLLECTION = '_private_integrations';
const PRIVATE_DOC_ID = 'google_workspace';

const PUBLIC_SETTINGS_COLLECTION = 'system_settings';
const PUBLIC_DOC_ID = 'google_workspace_public';

export class TokenStore {
  constructor(private db: admin.firestore.Firestore) {}

  /**
   * Checks whether an authenticated email belongs to a Master Admin.
   * Relies strictly on Firestore `admins/{email}` document with `role: 'master'`.
   * No hardcoded bootstrap email fallback.
   */
  async isMasterAdmin(email: string): Promise<boolean> {
    if (!email) return false;
    const normalizedEmail = email.trim().toLowerCase();
    const adminDoc = await this.db.collection('admins').doc(normalizedEmail).get();
    if (!adminDoc.exists) {
      return false;
    }
    const data = adminDoc.data();
    return data?.role === 'master';
  }

  /**
   * Checks whether an authenticated email belongs to an Admin.
   * Relies strictly on Firestore `admins/{email}` document existence.
   * No hardcoded bootstrap email fallback.
   */
  async isAdmin(email: string): Promise<boolean> {
    if (!email) return false;
    const normalizedEmail = email.trim().toLowerCase();
    const adminDoc = await this.db.collection('admins').doc(normalizedEmail).get();
    return adminDoc.exists;
  }

  /**
   * Stores the refresh token securely in private collection and updates public status.
   */
  async saveRefreshToken(
    refreshToken: string,
    connectedEmail: string | null,
    updatedBy: string,
    scopes: string[]
  ): Promise<void> {
    const now = admin.firestore.FieldValue.serverTimestamp();

    const privateData: PrivateGoogleIntegrationData = {
      refreshToken,
      connectedEmail,
      updatedAt: now,
      updatedBy,
      scopes,
    };

    const publicData: PublicGoogleIntegrationData = {
      state: 'connected',
      connectedEmail,
      connectedAt: now,
      lastVerifiedAt: now,
    };

    const batch = this.db.batch();
    batch.set(
      this.db.collection(PRIVATE_INTEGRATION_COLLECTION).doc(PRIVATE_DOC_ID),
      privateData,
      { merge: true }
    );
    batch.set(
      this.db.collection(PUBLIC_SETTINGS_COLLECTION).doc(PUBLIC_DOC_ID),
      publicData,
      { merge: true }
    );

    await batch.commit();
  }

  /**
   * Atomically replaces active account after new account validation succeeded.
   */
  async safeReplaceAccount(
    newRefreshToken: string,
    newEmail: string | null,
    updatedBy: string,
    scopes: string[]
  ): Promise<void> {
    await this.saveRefreshToken(newRefreshToken, newEmail, updatedBy, scopes);
  }

  /**
   * Retrieves the stored refresh token. (Server-side only)
   */
  async getRefreshToken(): Promise<{ refreshToken: string | null; connectedEmail: string | null }> {
    const snap = await this.db
      .collection(PRIVATE_INTEGRATION_COLLECTION)
      .doc(PRIVATE_DOC_ID)
      .get();

    if (!snap.exists) {
      return { refreshToken: null, connectedEmail: null };
    }

    const data = snap.data() as PrivateGoogleIntegrationData;
    return {
      refreshToken: data.refreshToken || null,
      connectedEmail: data.connectedEmail || null,
    };
  }

  /**
   * Marks public state as reauth_required when refresh token is invalid or revoked.
   */
  async markTokenReauthRequired(): Promise<void> {
    await this.db
      .collection(PUBLIC_SETTINGS_COLLECTION)
      .doc(PUBLIC_DOC_ID)
      .set(
        {
          state: 'reauth_required',
          lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /**
   * Updates last verified timestamp when token check succeeds.
   */
  async markTokenValid(): Promise<void> {
    await this.db
      .collection(PUBLIC_SETTINGS_COLLECTION)
      .doc(PUBLIC_DOC_ID)
      .set(
        {
          state: 'connected',
          lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /**
   * Updates the recurring meeting Form template metadata in public settings.
   */
  async setTemplateForm(templateFormId: string, templateFormTitle: string): Promise<void> {
    await this.db
      .collection(PUBLIC_SETTINGS_COLLECTION)
      .doc(PUBLIC_DOC_ID)
      .set(
        {
          templateFormId,
          templateFormTitle,
          lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /**
   * Clears stored tokens and resets public integration status.
   */
  async removeIntegration(updatedBy: string): Promise<void> {
    const batch = this.db.batch();
    batch.delete(this.db.collection(PRIVATE_INTEGRATION_COLLECTION).doc(PRIVATE_DOC_ID));
    batch.set(
      this.db.collection(PUBLIC_SETTINGS_COLLECTION).doc(PUBLIC_DOC_ID),
      {
        state: 'disconnected',
        connectedEmail: null,
        connectedAt: null,
        lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  }

  /**
   * Fetches public integration status.
   */
  async getPublicStatus(): Promise<PublicGoogleIntegrationData> {
    const snap = await this.db
      .collection(PUBLIC_SETTINGS_COLLECTION)
      .doc(PUBLIC_DOC_ID)
      .get();

    if (!snap.exists) {
      return {
        state: 'disconnected',
        connectedEmail: null,
        connectedAt: null,
        lastVerifiedAt: null,
      };
    }

    return snap.data() as PublicGoogleIntegrationData;
  }
}
