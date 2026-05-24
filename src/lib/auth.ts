import { authApi, type ApiAuthUser } from "./api";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  provider: string | null;
}

interface SessionResult {
  user: AuthUser;
  accessToken: string;
}

const SESSION_TOKEN = "SERVER_SESSION";

const mapUser = (user: ApiAuthUser): AuthUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  provider: user.provider,
});

let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: (message?: string) => void
) => {
  const mockUserStr = localStorage.getItem("HPP_MOCK_USER");
  if (mockUserStr) {
    try {
      const mockUser = JSON.parse(mockUserStr) as AuthUser;
      cachedAccessToken = SESSION_TOKEN;
      if (onAuthSuccess) {
        setTimeout(() => onAuthSuccess(mockUser, SESSION_TOKEN), 0);
      }
      return () => {};
    } catch (_error) {
      localStorage.removeItem("HPP_MOCK_USER");
    }
  }

  void authApi
    .me()
    .then(({ user }) => {
      cachedAccessToken = SESSION_TOKEN;
      onAuthSuccess?.(mapUser(user), SESSION_TOKEN);
    })
    .catch((error: Error) => {
      cachedAccessToken = null;
      if (error.message !== "Belum login.") {
        onAuthFailure?.(error.message);
        return;
      }
      onAuthFailure?.();
    });

  return () => {};
};

export const emailPasswordSignIn = async (email: string, password: string): Promise<SessionResult | null> => {
  const { user } = await authApi.login(email, password);
  cachedAccessToken = SESSION_TOKEN;
  return { user: mapUser(user), accessToken: SESSION_TOKEN };
};

export const emailPasswordSignUp = async (
  email: string,
  password: string,
  businessName?: string
): Promise<SessionResult | null> => {
  const { user } = await authApi.signup(email, password, businessName);
  cachedAccessToken = SESSION_TOKEN;
  return { user: mapUser(user), accessToken: SESSION_TOKEN };
};

export const getAccessToken = async (): Promise<string | null> => cachedAccessToken;

export const logout = async () => {
  localStorage.removeItem("HPP_MOCK_USER");
  try {
    await authApi.logout();
  } finally {
    cachedAccessToken = null;
  }
};
