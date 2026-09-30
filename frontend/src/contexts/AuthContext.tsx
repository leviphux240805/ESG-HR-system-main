import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type DemoRole,
  demoRole,
  fetchMe,
  IS_DEMO,
  login as loginRequest,
  logout as logoutRequest,
  type Me,
  queryClient,
  refreshAccessToken,
  setAccessToken,
  setDemoRole,
  setSelectedSchoolId as setClientSchool,
  setSessionExpiredHandler,
  type SchoolSummary,
} from "@/api";
import { type RoleCode, rolesInScope } from "@/lib/permissions";

export type { Me, RoleCode, SchoolSummary };

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextType {
  status: AuthStatus;
  me: Me | null;
  /** Cơ sở đang chọn; null = "Tất cả cơ sở" (chỉ vai trò cấp chuỗi). */
  selectedSchoolId: string | null;
  selectSchool: (schoolId: string | null) => void;
  /** Có vai trò áp dụng cho phạm vi đang chọn. Chỉ dùng để ẩn/hiện giao diện; quyền thật kiểm tra ở backend. */
  hasRole: (...roles: RoleCode[]) => boolean;
  login: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  /** Bản demo: đăng nhập giả theo vai trò. */
  loginAs: (role: DemoRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const schoolStorageKey = (userId: string) => `preschool.selectedSchool.${userId}`;

function readStoredSchool(userId: string): string | null | undefined {
  try {
    const value = localStorage.getItem(schoolStorageKey(userId));
    if (value === null) return undefined;
    return value === "ALL" ? null : value;
  } catch {
    return undefined;
  }
}

function storeSchool(userId: string, schoolId: string | null) {
  try {
    localStorage.setItem(schoolStorageKey(userId), schoolId ?? "ALL");
  } catch {
    // Trình duyệt chặn localStorage: chỉ mất ghi nhớ lựa chọn, không ảnh hưởng chức năng
  }
}

/** Chọn cơ sở ban đầu: lựa chọn đã lưu nếu còn hợp lệ, nếu không thì "Tất cả" (cấp chuỗi) hoặc cơ sở đầu tiên. */
function initialSchool(me: Me): string | null {
  const stored = readStoredSchool(me.id);
  if (stored === null && me.chainWide) return null;
  if (stored && me.schools.some((s) => s.id === stored)) return stored;
  return me.chainWide ? null : (me.schools[0]?.id ?? null);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setClientSchool(null);
    setMe(null);
    setSelectedSchoolId(null);
    setStatus("anonymous");
    queryClient.clear();
  }, []);

  const loadMe = useCallback(async () => {
    const profile = await fetchMe();
    const school = initialSchool(profile);
    setClientSchool(school);
    setSelectedSchoolId(school);
    setMe(profile);
    setStatus("authenticated");
  }, []);

  // Khôi phục phiên khi tải trang: đổi cookie refresh lấy access token rồi nạp /me
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (IS_DEMO ? (await demoRole()) !== null : await refreshAccessToken()) {
          await loadMe();
          return;
        }
      } catch {
        // rơi xuống trạng thái chưa đăng nhập
      }
      if (!cancelled) clearSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession, loadMe]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      toast.error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(
    async (identifier: string, password: string, rememberMe: boolean) => {
      await loginRequest(identifier, password, rememberMe);
      await loadMe();
    },
    [loadMe],
  );

  const loginAs = useCallback(
    async (role: DemoRole) => {
      await setDemoRole(role);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      if (IS_DEMO) await setDemoRole(null);
      else await logoutRequest();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const selectSchool = useCallback(
    (schoolId: string | null) => {
      if (!me) return;
      if (schoolId === null && !me.chainWide) return;
      if (schoolId !== null && !me.schools.some((s) => s.id === schoolId)) return;
      // Header X-School-Id đổi ngay; query dùng schoolQueryKey (useCurrentSchool) tự tải lại theo cơ sở mới
      setClientSchool(schoolId);
      setSelectedSchoolId(schoolId);
      storeSchool(me.id, schoolId);
    },
    [me],
  );

  const hasRole = useCallback(
    (...roles: RoleCode[]) => rolesInScope(me?.roles ?? [], selectedSchoolId).some((r) => roles.includes(r)),
    [me, selectedSchoolId],
  );

  const value = useMemo(
    () => ({ status, me, selectedSchoolId, selectSchool, hasRole, login, loginAs, logout }),
    [status, me, selectedSchoolId, selectSchool, hasRole, login, loginAs, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
