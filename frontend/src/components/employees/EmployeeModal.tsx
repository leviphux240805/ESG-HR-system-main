import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { User, X } from "lucide-react";
import { PersonalInfoTab } from "./tabs/PersonalInfoTab";
import { LaborRecordsTab } from "./tabs/LaborRecordsTab";
import { SalaryConfigTab } from "./tabs/SalaryConfigTab";
import { InsuranceTab } from "./tabs/InsuranceTab";
import { SkillsDevelopmentTab } from "./tabs/SkillsDevelopmentTab";
import { WorkTimeLeaveTab } from "./tabs/WorkTimeLeaveTab";
import { SafetyComplianceTab } from "./tabs/SafetyComplianceTab";
import { EmployeeFormData } from "./schemas/employeeFormSchema";
import { toast } from "sonner";
import { Employee } from "@/types";
import { useEmployeeForm } from "@/hooks/useEmployeeForm";

interface EmployeeModalProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (data: EmployeeFormData) => Promise<void>;
}

export function EmployeeModal({
  employee,
  open,
  onOpenChange,
  onSave,
}: EmployeeModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useEmployeeForm(employee, open);

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(data);
      }
      toast.success("Đã lưu thông tin nhân viên thành công!");
      // onOpenChange(false); // Keep modal open
    } catch (error) {
      toast.error("Lưu thông tin thất bại");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!employee) return null;

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
    const errorMessages = Object.keys(errors).map((key) => {
      const error = errors[key];
      // Handle nested errors (e.g. permanentAddress.perm_province)
      if (typeof error === "object" && error !== null && "message" in error) {
         return (error as any).message;
      }
      return `${key}: Invalid`;
    });

    const firstError = Object.values(errors).find((err: any) => err.message);
    const message = (firstError as any)?.message || "Vui lòng kiểm tra lại thông tin nhập liệu.";

    toast.error("Không thể lưu thông tin", {
      description: message,
      duration: 5000,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card max-h-[90vh] rounded-xl shadow-lg border border-border/50 overflow-hidden flex flex-col p-0">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onError)}
            className="flex flex-col h-full overflow-hidden"
          >
            <Tabs
              defaultValue="personal"
              className="w-full flex flex-col flex-1 overflow-hidden"
            >
              <div className="sticky top-0 z-10 bg-card pt-4 pb-3 px-6 flex flex-col border-b border-border/50">
                <div className="flex items-start justify-between">
                  <DialogHeader className="pb-0 relative top-0 left-0 flex items-center">
                    <DialogTitle className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">
                          {employee.name}
                        </h2>
                        <p className="text-sm text-muted-foreground font-normal">
                          {employee.department}
                        </p>
                      </div>
                    </DialogTitle>
                  </DialogHeader>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 ml-2"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <TabsList className="grid w-full grid-cols-7 bg-muted rounded-lg p-1 mt-2 h-auto">
                  <TabsTrigger
                    value="personal"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    Cá nhân
                  </TabsTrigger>
                  <TabsTrigger
                    value="labor"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    Hồ sơ LĐ
                  </TabsTrigger>
                  <TabsTrigger
                    value="salary"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    Lương
                  </TabsTrigger>
                  <TabsTrigger
                    value="insurance"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    BH & Thuế
                  </TabsTrigger>
                  <TabsTrigger
                    value="skills"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    Năng lực
                  </TabsTrigger>
                  <TabsTrigger
                    value="worktime"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    Nghỉ phép
                  </TabsTrigger>
                  <TabsTrigger
                    value="safety"
                    className="rounded-md text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm px-2 py-1.5"
                  >
                    An toàn
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 px-6 hide-scrollbar">
                <div className="space-y-6 py-4">
                  <TabsContent value="personal" className="space-y-6 m-0">
                    <PersonalInfoTab employee={employee} />
                  </TabsContent>

                  <TabsContent value="labor" className="space-y-6 m-0">
                    <LaborRecordsTab  employee={employee}/>
                  </TabsContent>

                  <TabsContent value="salary" className="space-y-6 m-0">
                    <SalaryConfigTab employee={employee} />
                  </TabsContent>

                  <TabsContent value="insurance" className="space-y-6 m-0">
                    <InsuranceTab employee={employee} />
                  </TabsContent>

                  <TabsContent value="skills" className="space-y-6 m-0">
                    <SkillsDevelopmentTab />
                  </TabsContent>

                  <TabsContent value="worktime" className="space-y-6 m-0">
                    <WorkTimeLeaveTab employee={employee} />
                  </TabsContent>

                  <TabsContent value="safety" className="space-y-6 m-0">
                    <SafetyComplianceTab employee={employee} />
                  </TabsContent>
                </div>
              </div>
            </Tabs>
            <DialogFooter className="gap-3 bg-card py-3 px-6 border-t border-border/50 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90"
              >
                {isSaving ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
