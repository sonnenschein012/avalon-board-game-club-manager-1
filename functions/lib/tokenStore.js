"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenStore = void 0;
const admin = __importStar(require("firebase-admin"));
const PRIVATE_INTEGRATION_COLLECTION = '_private_integrations';
const PRIVATE_DOC_ID = 'google_workspace';
const PUBLIC_SETTINGS_COLLECTION = 'system_settings';
const PUBLIC_DOC_ID = 'google_workspace_public';
class TokenStore {
    constructor(db) {
        this.db = db;
    }
    /**
     * Checks whether an authenticated email belongs to a Master Admin.
     * Relies strictly on Firestore `admins/{email}` document with `role: 'master'`.
     * No hardcoded bootstrap email fallback.
     */
    async isMasterAdmin(email) {
        if (!email)
            return false;
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
    async isAdmin(email) {
        if (!email)
            return false;
        const normalizedEmail = email.trim().toLowerCase();
        const adminDoc = await this.db.collection('admins').doc(normalizedEmail).get();
        return adminDoc.exists;
    }
    /**
     * Stores the refresh token securely in private collection and updates public status.
     */
    async saveRefreshToken(refreshToken, connectedEmail, updatedBy, scopes) {
        const now = admin.firestore.FieldValue.serverTimestamp();
        const privateData = {
            refreshToken,
            connectedEmail,
            updatedAt: now,
            updatedBy,
            scopes,
        };
        const publicData = {
            state: 'connected',
            connectedEmail,
            connectedAt: now,
            lastVerifiedAt: now,
        };
        const batch = this.db.batch();
        batch.set(this.db.collection(PRIVATE_INTEGRATION_COLLECTION).doc(PRIVATE_DOC_ID), privateData, { merge: true });
        batch.set(this.db.collection(PUBLIC_SETTINGS_COLLECTION).doc(PUBLIC_DOC_ID), publicData, { merge: true });
        await batch.commit();
    }
    /**
     * Atomically replaces active account after new account validation succeeded.
     */
    async safeReplaceAccount(newRefreshToken, newEmail, updatedBy, scopes) {
        await this.saveRefreshToken(newRefreshToken, newEmail, updatedBy, scopes);
    }
    /**
     * Retrieves the stored refresh token. (Server-side only)
     */
    async getRefreshToken() {
        const snap = await this.db
            .collection(PRIVATE_INTEGRATION_COLLECTION)
            .doc(PRIVATE_DOC_ID)
            .get();
        if (!snap.exists) {
            return { refreshToken: null, connectedEmail: null };
        }
        const data = snap.data();
        return {
            refreshToken: data.refreshToken || null,
            connectedEmail: data.connectedEmail || null,
        };
    }
    /**
     * Marks public state as reauth_required when refresh token is invalid or revoked.
     */
    async markTokenReauthRequired() {
        await this.db
            .collection(PUBLIC_SETTINGS_COLLECTION)
            .doc(PUBLIC_DOC_ID)
            .set({
            state: 'reauth_required',
            lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    /**
     * Updates last verified timestamp when token check succeeds.
     */
    async markTokenValid() {
        await this.db
            .collection(PUBLIC_SETTINGS_COLLECTION)
            .doc(PUBLIC_DOC_ID)
            .set({
            state: 'connected',
            lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    /**
     * Updates the recurring meeting Form template metadata in public settings.
     */
    async setTemplateForm(templateFormId, templateFormTitle) {
        await this.db
            .collection(PUBLIC_SETTINGS_COLLECTION)
            .doc(PUBLIC_DOC_ID)
            .set({
            templateFormId,
            templateFormTitle,
            lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    /**
     * Clears stored tokens and resets public integration status.
     */
    async removeIntegration(updatedBy) {
        const batch = this.db.batch();
        batch.delete(this.db.collection(PRIVATE_INTEGRATION_COLLECTION).doc(PRIVATE_DOC_ID));
        batch.set(this.db.collection(PUBLIC_SETTINGS_COLLECTION).doc(PUBLIC_DOC_ID), {
            state: 'disconnected',
            connectedEmail: null,
            connectedAt: null,
            lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();
    }
    /**
     * Fetches public integration status.
     */
    async getPublicStatus() {
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
        return snap.data();
    }
}
exports.TokenStore = TokenStore;
//# sourceMappingURL=tokenStore.js.map