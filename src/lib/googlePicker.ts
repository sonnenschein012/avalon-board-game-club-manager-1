import firebaseConfig from '@firebase-config';
import { getPickerAccessToken } from '../services/googleWorkspaceService';

interface GooglePickerDoc {
  id: string;
  name?: string;
  mimeType?: string;
  url?: string;
}

interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDoc[];
}

interface GooglePickerDocsView {
  setIncludeFolders: (include: boolean) => GooglePickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  setMimeTypes: (mimeTypes: string) => GooglePickerDocsView;
}

interface GooglePickerBuilder {
  enableFeature: (feature: string) => GooglePickerBuilder;
  setAppId: (appId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  addView: (view: GooglePickerDocsView) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerCallbackData) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GooglePickerNamespace {
  picker: {
    ViewId: {
      FORMS: string;
      SPREADSHEETS: string;
    };
    Feature: {
      NAV_HIDDEN: string;
      SUPPORT_DRIVES: string;
    };
    Action: {
      PICKED: string;
      CANCEL: string;
    };
    DocsView: new (viewId: string) => GooglePickerDocsView;
    PickerBuilder: new () => GooglePickerBuilder;
  };
}

interface GoogleGapiNamespace {
  load: (apiName: string, config: { callback: () => void; onerror?: () => void }) => void;
}

declare global {
  interface Window {
    gapi: GoogleGapiNamespace;
    google: GooglePickerNamespace;
  }
}

let isGapiLoaded = false;
let isPickerLoaded = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

/**
 * Lazily loads the Google API client library (gapi) and the Google Picker module.
 */
export async function loadGooglePickerApi(): Promise<void> {
  if (isGapiLoaded && isPickerLoaded && window.google?.picker) {
    return;
  }

  await loadScript('https://apis.google.com/js/api.js');
  isGapiLoaded = true;

  await new Promise<void>((resolve, reject) => {
    window.gapi.load('picker', {
      callback: () => {
        isPickerLoaded = true;
        resolve();
      },
      onerror: () => reject(new Error('Google Picker API 로드에 실패했습니다.')),
    });
  });
}

export interface PickedGoogleFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
}

export interface OpenGooglePickerOptions {
  type: 'form' | 'spreadsheet';
  title?: string;
}

/**
 * Resolves the Google Cloud Project Number required by Google Picker (setAppId).
 * In Google Cloud / Firebase Web Config, messagingSenderId corresponds directly to the Cloud Project Number.
 */
export function getGoogleCloudProjectNumber(): string {
  // 1. Explicit env or config
  const customProjectNumber = import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_NUMBER;
  if (customProjectNumber) return customProjectNumber;

  // 2. From appId "1:<project_number>:web:<app_id>"
  if (firebaseConfig.appId && firebaseConfig.appId.includes(':')) {
    const parts = firebaseConfig.appId.split(':');
    if (parts[1]) return parts[1];
  }
  // 3. From messagingSenderId (Standard Project Number in Firebase config)
  return firebaseConfig.messagingSenderId || '';
}

/**
 * Resolves the dedicated Google Picker Browser API Key.
 * Keeps Picker API Key separated from Firebase Web API Key for least-privilege scoping.
 */
export function getGooglePickerApiKey(): string {
  const customPickerKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  if (customPickerKey) return customPickerKey;

  const configWithPicker = firebaseConfig as { apiKey?: string; pickerApiKey?: string };
  if (configWithPicker.pickerApiKey) return configWithPicker.pickerApiKey;

  // Fallback to Firebase API key if no dedicated Picker key is configured
  return firebaseConfig.apiKey || '';
}

/**
 * Opens Google Picker popup in memory without persisting tokens.
 */
export async function openGooglePicker(
  options: OpenGooglePickerOptions
): Promise<PickedGoogleFile | null> {
  await loadGooglePickerApi();

  // Fetch short-lived access token into memory (never saved to localStorage/sessionStorage)
  const { accessToken } = await getPickerAccessToken();

  const apiKey = getGooglePickerApiKey();
  const projectNumber = getGoogleCloudProjectNumber();

  return new Promise((resolve, reject) => {
    try {
      const google = window.google;
      if (!google || !google.picker) {
        throw new Error('Google Picker SDK not initialized');
      }

      let mimeType = 'application/vnd.google-apps.form';
      let viewId = google.picker.ViewId.FORMS;

      if (options.type === 'spreadsheet') {
        mimeType = 'application/vnd.google-apps.spreadsheet';
        viewId = google.picker.ViewId.SPREADSHEETS;
      }

      const docsView = new google.picker.DocsView(viewId)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes(mimeType);

      const pickerBuilder = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
        .setAppId(projectNumber)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .addView(docsView)
        .setTitle(options.title || (options.type === 'form' ? '정기모임 설문 템플릿 선택' : '출석 응답 스프레드시트 선택'))
        .setCallback((data: GooglePickerCallbackData) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            if (doc) {
              resolve({
                id: doc.id,
                name: doc.name || '',
                mimeType: doc.mimeType || mimeType,
                url: doc.url || '',
              });
            } else {
              resolve(null);
            }
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        });

      const picker = pickerBuilder.build();
      picker.setVisible(true);
    } catch (error) {
      console.error('Failed to open Google Picker:', error);
      reject(error);
    }
  });
}
