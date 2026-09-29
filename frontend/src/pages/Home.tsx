import { AuthenticatedLayout } from "@/components/layout/AuthenticatedLayout";
import { useAuth } from "@/contexts/AuthContext";

/** Trang chủ tạm của giai đoạn 1; dashboard thật làm ở giai đoạn 7. */
export default function Home() {
  const { me, selectedSchoolId } = useAuth();
  const schoolName = selectedSchoolId
    ? me?.schools.find((s) => s.id === selectedSchoolId)?.name
    : "Tất cả cơ sở";

  return (
    <AuthenticatedLayout>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Xin chào, {me?.fullName}</h1>
        <p className="text-muted-foreground">
          Đang xem: <span className="font-medium text-foreground">{schoolName}</span>
        </p>
      </div>
    </AuthenticatedLayout>
  );
}
