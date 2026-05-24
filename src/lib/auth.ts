import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace scopes
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check for mock user first
  const mockUserStr = localStorage.getItem("HPP_MOCK_USER");
  if (mockUserStr) {
    try {
      const mockUser = JSON.parse(mockUserStr) as unknown as User;
      cachedAccessToken = "LOCAL_STORAGE_TOKEN";
      if (onAuthSuccess) {
        setTimeout(() => onAuthSuccess(mockUser, cachedAccessToken!), 0);
      }
      return () => {}; // return dummy unsubscribe
    } catch (e) {
      localStorage.removeItem("HPP_MOCK_USER");
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken || user.providerData.some(p => p.providerId === "password")) {
        // If password provider, fake the access token so the app falls back to local storage
        if (!cachedAccessToken) cachedAccessToken = "LOCAL_STORAGE_TOKEN";
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("Login dibatalkan oleh pengguna.");
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignIn = async (email: string, password: string): Promise<{user: User; accessToken: string} | null> => {
  try {
    isSigningIn = true;
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const result = await signInWithEmailAndPassword(auth, email, password);
    // For email/password login against Google Sheets API, we don't naturally get an OAuth token.
    // However, since we fallback to Local Storage when there is no Google OAuth token,
    // we use a dummy token to tell the app to rely on local storage.
    cachedAccessToken = "LOCAL_STORAGE_TOKEN";
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Email sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const emailPasswordSignUp = async (email: string, password: string): Promise<{user: User; accessToken: string} | null> => {
  try {
    isSigningIn = true;
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    cachedAccessToken = "LOCAL_STORAGE_TOKEN";
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Email sign up error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  localStorage.removeItem("HPP_MOCK_USER");
  try {
    await auth.signOut();
  } catch (err) {
    console.error("Firebase logout error:", err);
  }
  cachedAccessToken = null;
};
