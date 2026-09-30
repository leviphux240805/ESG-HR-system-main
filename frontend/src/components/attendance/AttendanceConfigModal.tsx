import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Save, Loader2, Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { commonHolidays, Holiday } from "@/data/vietnameseHolidays";
import { DatePickerCustom } from "@/components/legacy/DatePickerCustom";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AttendanceConfig {
  id?: string;
  max_late_count_allowed: number;
  late_grace_minutes: number;
  official_start_time: string;
  apply_from: string;
}

interface AttendanceConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHolidayChange?: () => void;
}

export function AttendanceConfigModal({ open, onOpenChange, onHolidayChange }: AttendanceConfigModalProps) {
  // Config state
  const [config, setConfig] = useState<AttendanceConfig>({
    max_late_count_allowed: 3,
    late_grace_minutes: 15,
    official_start_time: "08:00",
    apply_from: new Date().toISOString().split("T")[0],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Holiday state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [selectedHolidayType, setSelectedHolidayType] = useState<string>("");
  const [customHolidayName, setCustomHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState<string>("");
  const [holidayEndDate, setHolidayEndDate] = useState<string>("");
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  useEffect(() => {
    if (open) {
      fetchConfig();
      fetchHolidays();
    }
  }, [open]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("attendance_config")
        .select("*")
        .order("apply_from", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setConfig({
          id: data.id,
          max_late_count_allowed: data.max_late_count_allowed,
          late_grace_minutes: data.late_grace_minutes,
          official_start_time: data.official_start_time,
          apply_from: data.apply_from,
        });
      }
    } catch (err: any) {
      console.error("Error fetching config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    setIsLoadingHolidays(true);
    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (err: any) {
      console.error("Error fetching holidays:", err);
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("attendance_config")
        .upsert({
          id: config.id,
          max_late_count_allowed: config.max_late_count_allowed,
          late_grace_minutes: config.late_grace_minutes,
          official_start_time: config.official_start_time,
          apply_from: config.apply_from,
        });

      if (error) throw error;

      toast.success("Đã lưu cấu hình chấm công");
    } catch (err: any) {
      toast.error("Lỗi lưu cấu hình: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!holidayDate) {
      toast.error("Vui lòng chọn ngày bắt đầu");
      return;
    }

    const holidayName = selectedHolidayType === "custom" 
      ? customHolidayName 
      : commonHolidays.find(h => h.id === selectedHolidayType)?.name;

    if (!holidayName) {
      toast.error("Vui lòng chọn hoặc nhập tên ngày lễ");
      return;
    }

    setIsAddingHoliday(true);
    try {
      // Generate all dates in range
      const startDate = new Date(holidayDate);
      const endDate = holidayEndDate ? new Date(holidayEndDate) : startDate;
      const dates: string[] = [];
      
      const current = new Date(startDate);
      while (current <= endDate) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }

      // Insert all dates
      const insertData = dates.map(date => ({
        name: holidayName,
        holiday_date: date,
        is_custom: selectedHolidayType === "custom",
      }));

      const { data, error } = await supabase
        .from("holidays")
        .insert(insertData)
        .select();

      if (error) throw error;

      setHolidays([...holidays, ...(data || [])]);
      setSelectedHolidayType("");
      setCustomHolidayName("");
      setHolidayDate("");
      setHolidayEndDate("");
      toast.success(`Đã thêm ${dates.length} ngày lễ`);
      onHolidayChange?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Lỗi thêm ngày lễ: " + message);
    } finally {
      setIsAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from("holidays")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setHolidays(holidays.filter(h => h.id !== id));
      toast.success("Đã xóa ngày lễ");
      onHolidayChange?.();
    } catch (err: any) {
      toast.error("Lỗi xóa ngày lễ: " + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[550px] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Cài đặt chấm công
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2 bg-muted rounded-lg p-1">
              <TabsTrigger value="config" className="rounded-md text-sm">
                <Settings className="w-4 h-4 mr-2" />
                Cấu hình
              </TabsTrigger>
              <TabsTrigger value="holidays" className="rounded-md text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                Ngày lễ
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Config Tab */}
          <TabsContent value="config" className="flex-1 px-6 pb-6 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Giờ vào làm chính thức</Label>
                  <Input
                    type="time"
                    value={config.official_start_time}
                    onChange={(e) => setConfig({ ...config, official_start_time: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Số lần được phép muộn (X)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.max_late_count_allowed}
                      onChange={(e) => setConfig({ ...config, max_late_count_allowed: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Số lần/tháng</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Số phút tối đa mỗi lần (Y)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.late_grace_minutes}
                      onChange={(e) => setConfig({ ...config, late_grace_minutes: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Phút/lần</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Áp dụng từ ngày</Label>
                  <Input
                    type="date"
                    value={config.apply_from}
                    onChange={(e) => setConfig({ ...config, apply_from: e.target.value })}
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-1">Quy tắc tính muộn:</p>
                  <ul className="text-muted-foreground text-xs space-y-1">
                    <li>• Nếu muộn &gt; {config.late_grace_minutes} phút: Tính ngay 1 lần đi muộn</li>
                    <li>• Nếu muộn ≤ {config.late_grace_minutes} phút: Cho phép {config.max_late_count_allowed} lần/tháng</li>
                    <li>• Từ lần thứ {config.max_late_count_allowed + 1}: Bị tính đi muộn</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Đóng
                  </Button>
                  <Button onClick={handleSaveConfig} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lưu cấu hình
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Holidays Tab - Two Column Layout */}
          <TabsContent value="holidays" className="flex-1 px-6 pb-6 mt-4 overflow-hidden">
            <div className="flex gap-6 h-full">
              {/* Left: Add Holiday Form */}
              <div className="w-1/2 space-y-4">
                <h3 className="font-medium text-sm">Thêm ngày lễ mới</h3>
                
                <div className="space-y-2">
                  <Label>Tên ngày lễ</Label>
                  <Select value={selectedHolidayType} onValueChange={setSelectedHolidayType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn ngày lễ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {commonHolidays.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedHolidayType === "custom" && (
                  <div className="space-y-2">
                    <Label>Tên tùy chỉnh</Label>
                    <Input
                      placeholder="Nhập tên ngày nghỉ..."
                      value={customHolidayName}
                      onChange={(e) => setCustomHolidayName(e.target.value)}
                    />
                  </div>
                )}

                {/* Date pickers side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Từ ngày</Label>
                    <DatePickerCustom
                      value={holidayDate}
                      onChange={setHolidayDate}
                      placeholder="Chọn ngày..."
                      maxYear={new Date().getFullYear() + 10}
                      openDirection="right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Đến ngày <span className="text-muted-foreground text-xs">(tùy chọn)</span></Label>
                    <DatePickerCustom
                      value={holidayEndDate}
                      onChange={setHolidayEndDate}
                      placeholder="Chọn ngày..."
                      maxYear={new Date().getFullYear() + 10}
                      openDirection="right"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleAddHoliday} 
                  disabled={isAddingHoliday || !selectedHolidayType || !holidayDate}
                  className="w-full"
                >
                  {isAddingHoliday ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Thêm ngày lễ
                </Button>
              </div>

              {/* Right: Holiday List */}
              <div className="w-1/2 flex flex-col border-l pl-6">
                <h3 className="font-medium text-sm mb-3">Danh sách ngày lễ ({holidays.length})</h3>
                {isLoadingHolidays ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : holidays.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Chưa có ngày lễ nào.
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-4">
                      {holidays.map((holiday) => (
                        <div
                          key={holiday.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-background"
                        >
                          <div>
                            <p className="font-medium text-sm">{holiday.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                // Parse date string without timezone conversion
                                const [year, month, day] = holiday.holiday_date.split("-").map(Number);
                                const date = new Date(year, month - 1, day);
                                return date.toLocaleDateString("vi-VN", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "numeric",
                                  year: "numeric",
                                });
                              })()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteHoliday(holiday.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
