import { useAuth } from "@/contexts/AuthContext";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";

/** Trang chủ tạm của giai đoạn 1; dashboard thật làm ở giai đoạn 7. */
export default function Home() {
  const { me } = useAuth();
  const { school, isAllSchools } = useCurrentSchool();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-foreground">Xin chào, {me?.fullName}</h1>
      <p className="text-muted-foreground">
        Đang xem: <span className="font-medium text-foreground">{isAllSchools ? "Tất cả cơ sở" : school?.name}</span>
      </p>
    </div>
  );
}
