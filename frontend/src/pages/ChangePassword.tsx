import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { applyApiErrors, changePassword } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { TextField } from "@/features/staff/profile/fields";
import { PASSWORD_RULE, passwordField } from "@/lib/password";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: passwordField,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Mật khẩu nhập lại không khớp" });
type Values = z.infer<typeof schema>;

/** Tự đổi mật khẩu; bắt buộc khi đang dùng mật khẩu do hiệu trưởng cấp (lần đăng nhập đầu, sau khi bị đặt lại). */
export default function ChangePassword() {
  const { me, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const forced = me?.mustChangePassword ?? false;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await changePassword(v.currentPassword, v.newPassword);
      await refreshMe();
      toast.success("Đã đổi mật khẩu.");
      navigate("/", { replace: true });
    } catch (error) {
      applyApiErrors(error, form);
    }
  });

  return (
    <AuthLayout
      title="Đổi mật khẩu"
      subtitle={forced ? "Bạn đang dùng mật khẩu do nhà trường cấp. Hãy đặt mật khẩu của riêng bạn để tiếp tục." : "Đặt mật khẩu mới cho tài khoản của bạn"}
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField form={form} name="currentPassword" label={forced ? "Mật khẩu được cấp" : "Mật khẩu hiện tại"} type="password" required />
          <TextField form={form} name="newPassword" label="Mật khẩu mới" type="password" description={PASSWORD_RULE} required />
          <TextField form={form} name="confirm" label="Nhập lại mật khẩu mới" type="password" required />
          <Button type="submit" className="w-full min-h-11" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Đổi mật khẩu
          </Button>
        </form>
      </Form>
      <p className="text-center text-sm">
        {forced ? (
          <button type="button" onClick={logout} className="min-h-11 text-primary font-medium">
            Đăng xuất
          </button>
        ) : (
          <Link to="/" className="inline-flex min-h-11 items-center text-primary font-medium">
            Quay lại
          </Link>
        )}
      </p>
    </AuthLayout>
  );
}
