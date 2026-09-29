import { useState } from 'react';
import { Building2, Users, CreditCard, Bell, Shield, Globe } from 'lucide-react';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const settingsSections = [
  {
    id: 'company',
    icon: Building2,
    title: 'Thông tin công ty',
    description: 'Quản lý thông tin chi tiết tổ chức của bạn',
  },
  {
    id: 'payroll',
    icon: CreditCard,
    title: 'Cài đặt bảng lương',
    description: 'Cấu hình tùy chọn xử lý bảng lương',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Thông báo',
    description: 'Email và thông báo hệ thống',
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Bảo mật',
    description: 'Mật khẩu và cài đặt xác thực',
  },
  {
    id: 'localization',
    icon: Globe,
    title: 'Địa phương hóa',
    description: 'Ngôn ngữ và cài đặt khu vực',
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('company');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [payrollReminders, setPayrollReminders] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý tùy chọn ứng dụng của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="bg-card rounded-xl card-shadow p-4">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left',
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <section.icon className="w-5 h-5" />
                  <div>
                    <p className="text-sm font-medium">{section.title}</p>
                    <p
                      className={cn(
                        'text-xs',
                        activeSection === section.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {section.description}
                    </p>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 bg-card rounded-xl card-shadow">
            {/* Company Information */}
            {activeSection === 'company' && (
              <div className="p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-foreground mb-6">Thông tin công ty</h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Tên công ty
                      </label>
                      <input
                        type="text"
                        defaultValue="Acme Corporation"
                        className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Số đăng ký
                      </label>
                      <input
                        type="text"
                        defaultValue="REG-2024-001234"
                        className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Địa chỉ email
                      </label>
                      <input
                        type="email"
                        defaultValue="hr@acmecorp.com"
                        className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        defaultValue="+1 (555) 000-0000"
                        className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Địa chỉ
                    </label>
                    <textarea
                      rows={3}
                      defaultValue="123 Business Avenue, Suite 100, New York, NY 10001"
                      className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-foreground mb-6">Cài đặt thông báo</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Thông báo email</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nhận cập nhật email về bảng lương và thay đổi nhân viên
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Nhắc nhở bảng lương</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nhận nhắc nhở trước hạn chót xử lý bảng lương
                      </p>
                    </div>
                    <Switch
                      checked={payrollReminders}
                      onCheckedChange={setPayrollReminders}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security */}
            {activeSection === 'security' && (
              <div className="p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-foreground mb-6">Cài đặt bảo mật</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-foreground">Xác thực hai lớp</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Thêm một lớp bảo mật bổ sung cho tài khoản của bạn
                      </p>
                    </div>
                    <Switch
                      checked={twoFactorAuth}
                      onCheckedChange={setTwoFactorAuth}
                    />
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-3">Thay đổi mật khẩu</p>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="Mật khẩu hiện tại"
                        className="w-full px-4 py-2.5 bg-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                      <input
                        type="password"
                        placeholder="Mật khẩu mới"
                        className="w-full px-4 py-2.5 bg-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                      <input
                        type="password"
                        placeholder="Xác nhận mật khẩu mới"
                        className="w-full px-4 py-2.5 bg-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payroll Settings */}
            {activeSection === 'payroll' && (
              <div className="p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-foreground mb-6">Cấu hình bảng lương</h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Tần suất thanh toán
                      </label>
                      <select className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                        <option>Hàng tháng</option>
                        <option>Hai tuần một lần</option>
                        <option>Hàng tuần</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Đơn vị tiền tệ mặc định
                      </label>
                      <select className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                        <option>USD - Đô la Mỹ</option>
                        <option>EUR - Euro</option>
                        <option>GBP - Bảng Anh</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Localization */}
            {activeSection === 'localization' && (
              <div className="p-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-foreground mb-6">Cài đặt khu vực</h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Ngôn ngữ
                      </label>
                      <select className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                        <option>Tiếng Việt (VN)</option>
                        <option>Tiếng Anh (Mỹ)</option>
                        <option>Tiếng Anh (Anh)</option>
                        <option>Tiếng Tây Ban Nha</option>
                        <option>Tiếng Pháp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Múi giờ
                      </label>
                      <select className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                        <option>Giờ Miền Đông (ET)</option>
                        <option>Giờ Thái Bình Dương (PT)</option>
                        <option>Giờ Trung Âu (CET)</option>
                        <option>UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Định dạng ngày
                      </label>
                      <select className="w-full px-4 py-2.5 bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                        <option>MM/DD/YYYY</option>
                        <option>DD/MM/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <Button onClick={handleSave}>Lưu thay đổi</Button>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
