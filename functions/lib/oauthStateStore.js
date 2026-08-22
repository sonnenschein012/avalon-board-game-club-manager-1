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
exports.OAuthStateStore = void 0;
const crypto = __importStar(require("crypto"));
const OAUTH_STATES_COLLECTION = '_private_oauth_states';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
class OAuthStateStore {
    constructor(db) {
        this.db = db;
    }
    /**
     * Generates and securely stores a single-use CSRF state token tied to caller email.
     */
    async generateAndSaveState(callerEmail, mode = 'connect') {
        const state = crypto.randomBytes(32).toString('hex');
        const now = Date.now();
        const stateData = {
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
    async validateAndConsumeState(state, callerEmail) {
        if (!state) {
            return { valid: false, mode: 'connect' };
        }
        const docRef = this.db.collection(OAUTH_STATES_COLLECTION).doc(state);
        const normalizedEmail = callerEmail.trim().toLowerCase();
        try {
            return await this.db.runTransaction(async (transaction) => {
                const snap = await transaction.get(docRef);
                if (!snap.exists) {
                    return { valid: false, mode: 'connect' };
                }
                const data = snap.data();
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
        }
        catch (error) {
            console.error('Transaction error in validateAndConsumeState:', error);
            return { valid: false, mode: 'connect' };
        }
    }
}
exports.OAuthStateStore = OAuthStateStore;
//# sourceMappingURL=oauthStateStore.js.map