import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  School,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/States";
import { FormSheet } from "@/components/common/FormSheet";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SelectField, TextField } from "@/features/staff/profile/fields";
import {
  archiveClass,
  createClass,
  createSchoolYear,
  deleteClass,
  queryClient,
  updateClass,
  useAgeGroups,
  useClasses,
  useSchools,
  useSchoolYears,
  type ClassItem,
} from "@/api";
import { api, unwrap } from "@/api/client";
import { useCan } from "@/hooks/useCan";
import { useCurrentSchool } from "@/hooks/useCurrentSchool";
import { cn } from "@/lib/utils";

const classSchema = z
  .object({
    schoolId: z.string().min(1, "Vui lòng chọn trường."),
    schoolYearId: z.string().min(1, "Vui lòng chọn năm học."),
    name: z.string().trim().min(1, "Vui lòng nhập tên lớp.").max(100, "Tên lớp tối đa 100 ký tự."),
    ageGroupId: z.string().min(1, "Vui lòng chọn khối."),
    room: z.string().trim().max(50, "Phòng học tối đa 50 ký tự.").default(""),
    capacity: z.coerce.number().int().min(1, "Sĩ số phải lớn hơn 0.").max(100, "Sĩ số không quá 100."),
    mainTeacherId: z.string().default("none"),
    assistantTeacherId: z.string().default("none"),
  })
  .refine(
    (data) =>
      data.mainTeacherId === "none" ||
      data.assistantTeacherId === "none" ||
      data.mainTeacherId !== data.assistantTeacherId,
    {
      message: "Giáo viên chính và giáo viên phụ không được trùng nhau.",
      path: ["assistantTeacherId"],
    },
  );

type ClassFormValues = z.infer<typeof classSchema>;

/** Danh sách lớp của cơ sở: sĩ số, giáo viên, có mặt hôm nay. */
export default function ClassesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ClassItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClassItem | null>(null);
  const [creatingYear, setCreatingYear] = useState(false);

  const { schoolId } = useCurrentSchool();
  const canManage = useCan("manage", "classes");
  const canViewChildren = useCan("view", "children");

  const query = useClasses({ includeArchived: showArchived });
  const schoolsQuery = useSchools();
  const schoolYearsQuery = useSchoolYears();
  const ageGroupsQuery = useAgeGroups();

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      schoolId: schoolId ?? "",
      schoolYearId: "",
      name: "",
      ageGroupId: "",
      room: "",
      capacity: 30,
      mainTeacherId: "none",
      assistantTeacherId: "none",
    },
  });

  const watchedSchoolId = form.watch("schoolId");
  const watchedAgeGroupId = form.watch("ageGroupId");
  const watchedCapacity = form.watch("capacity");

  // Giáo viên của trường được chọn trong form
  const staffQuery = useQuery({
    queryKey: ["staff", "school", watchedSchoolId],
    queryFn: async () => {
      if (!watchedSchoolId) return [];
      const res = unwrap(
        await api.GET("/api/v1/staff", {
          params: { query: { schoolId: watchedSchoolId, size: 100, status: "ACTIVE" } },
        }),
      );
      return res.items;
    },
    enabled: !!watchedSchoolId,
  });

  const teacherOptions = useMemo(() => {
    const list = staffQuery.data ?? [];
    return [
      { value: "none", label: "Chưa phân công" },
      ...list.map((s) => ({ value: s.id, label: s.fullName })),
    ];
  }, [staffQuery.data]);

  const schoolOptions = useMemo(
    () => (schoolsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [schoolsQuery.data],
  );

  const yearOptions = useMemo(
    () => (schoolYearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name })),
    [schoolYearsQuery.data],
  );

  const ageGroupOptions = useMemo(
    () => (ageGroupsQuery.data ?? []).map((g) => ({ value: g.id, label: g.name })),
    [ageGroupsQuery.data],
  );

  // Điền form khi mở sheet
  useEffect(() => {
    if (editing === "new") {
      const currentYear = schoolYearsQuery.data?.find((y) => y.current);
      const defaultGroup = ageGroupsQuery.data?.[0];
      form.reset({
        schoolId: schoolId ?? schoolsQuery.data?.[0]?.id ?? "",
        schoolYearId: currentYear?.id ?? schoolYearsQuery.data?.[0]?.id ?? "",
        name: "",
        ageGroupId: defaultGroup?.id ?? "",
        room: "",
        capacity: defaultGroup?.maxClassSize ?? 30,
        mainTeacherId: "none",
        assistantTeacherId: "none",
      });
    } else if (editing) {
      const mainT = editing.teachers.find((t) => t.role === "MAIN");
      const asstT = editing.teachers.find((t) => t.role === "ASSISTANT");
      form.reset({
        schoolId: editing.schoolId,
        schoolYearId: editing.schoolYearId,
        name: editing.name,
        ageGroupId: editing.ageGroupId,
        room: editing.room ?? "",
        capacity: editing.capacity,
        mainTeacherId: mainT?.staffId ?? "none",
        assistantTeacherId: asstT?.staffId ?? "none",
      });
    }
  }, [editing, form, schoolId, schoolsQuery.data, schoolYearsQuery.data, ageGroupsQuery.data]);

  // Tự động gán sĩ số tối đa theo khối khi thêm mới
  useEffect(() => {
    if (editing === "new" && watchedAgeGroupId) {
      const group = ageGroupsQuery.data?.find((g) => g.id === watchedAgeGroupId);
      if (group) {
        form.setValue("capacity", group.maxClassSize);
      }
    }
  }, [watchedAgeGroupId, editing, ageGroupsQuery.data, form]);

  // Tự động chọn năm học hiện hành khi danh sách năm học tải xong
  useEffect(() => {
    if (editing && !form.getValues("schoolYearId") && schoolYearsQuery.data && schoolYearsQuery.data.length > 0) {
      const cur = schoolYearsQuery.data.find((y) => y.current) ?? schoolYearsQuery.data[0];
      if (cur) {
        form.setValue("schoolYearId", cur.id, { shouldValidate: true });
      }
    }
  }, [editing, schoolYearsQuery.data, form]);

  const handleQuickCreateYear = async () => {
    try {
      setCreatingYear(true);
      const newYear = await createSchoolYear({
        name: "2026–2027",
        startDate: "2026-09-01",
        endDate: "2027-05-31",
      });
      await queryClient.invalidateQueries({ queryKey: ["school-years"] });
      form.setValue("schoolYearId", newYear.id, { shouldValidate: true });
      toast.success("Đã tạo năm học 2026–2027.");
    } catch {
      toast.error("Không thể tạo năm học.");
    } finally {
      setCreatingYear(false);
    }
  };

  const selectedGroup = ageGroupsQuery.data?.find((g) => g.id === watchedAgeGroupId);
  const isCapacityExceeded = selectedGroup && watchedCapacity > selectedGroup.maxClassSize;
  const editingClass = editing && editing !== "new" ? editing : null;
  const isCurrentEnrollmentExceeded = editingClass && editingClass.size > watchedCapacity;

  const onSubmit = async (v: ClassFormValues) => {
    const payload = {
      schoolId: v.schoolId,
      schoolYearId: v.schoolYearId,
      name: v.name.trim(),
      ageGroupId: v.ageGroupId,
      room: v.room.trim() || undefined,
      capacity: v.capacity,
      mainTeacherId: v.mainTeacherId !== "none" ? v.mainTeacherId : undefined,
      assistantTeacherId: v.assistantTeacherId !== "none" ? v.assistantTeacherId : undefined,
    };
    if (editingClass) {
      await updateClass(editingClass.id, payload);
      toast.success("Đã cập nhật lớp học.");
    } else {
      await createClass(payload);
      toast.success("Đã thêm lớp học mới.");
    }
    await queryClient.invalidateQueries({ queryKey: ["classes"] });
    setEditing(null);
  };

  const handleArchive = async (cls: ClassItem) => {
    await archiveClass(cls.id, !cls.archived);
    toast.success(cls.archived ? `Đã khôi phục lớp ${cls.name}.` : `Đã lưu trữ lớp ${cls.name}.`);
    await queryClient.invalidateQueries({ queryKey: ["classes"] });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteClass(deleting.id);
    toast.success(`Đã xóa lớp ${deleting.name}.`);
    await queryClient.invalidateQueries({ queryKey: ["classes"] });
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Lớp học"
        description="Sĩ số, giáo viên phụ trách và tình hình đi học hôm nay."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
              className="min-h-11"
            >
              {showArchived ? "Ẩn lưu trữ" : "Hiện lưu trữ"}
            </Button>
            {canManage && (
              <Button onClick={() => setEditing("new")} className="min-h-11">
                <Plus className="mr-1 h-4 w-4" /> Thêm lớp
              </Button>
            )}
          </div>
        }
      />

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={School} title="Chưa có lớp" description="Lớp của cơ sở sẽ hiện ở đây." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {query.data.map((c) => (
            <Card
              key={c.id}
              className={cn("flex flex-col", c.archived && "opacity-75 bg-muted/30 border-dashed")}
            >
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{c.name}</p>
                      {c.archived && <Badge variant="outline">Đã lưu trữ</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[c.ageGroupName, c.room].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {c.canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thao tác lớp">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(c)}>
                          <Pencil className="mr-2 h-4 w-4" /> Sửa lớp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(c)}>
                          {c.archived ? (
                            <>
                              <ArchiveRestore className="mr-2 h-4 w-4" /> Khôi phục lớp
                            </>
                          ) : (
                            <>
                              <Archive className="mr-2 h-4 w-4" /> Lưu trữ lớp
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={c.size > 0}
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Xóa hẳn
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div>
                  <div className="flex justify-between text-sm">
                    <span>Sĩ số</span>
                    <span className={cn("font-medium", c.size > c.capacity && "text-destructive font-bold")}>
                      {c.size}/{c.capacity}
                      {c.size > c.capacity && " (Vượt sĩ số)"}
                    </span>
                  </div>
                  <Progress
                    value={c.capacity ? (c.size / c.capacity) * 100 : 0}
                    className={cn("mt-1 h-2", c.size > c.capacity && "[&>div]:bg-destructive")}
                    aria-label={`Sĩ số lớp ${c.name}`}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.boys} bé trai · {c.girls} bé gái
                  </p>
                </div>

                <div className="text-sm">
                  <p className="text-muted-foreground">Giáo viên</p>
                  {c.teachers.length ? (
                    c.teachers.map((t) => (
                      <p key={t.id}>
                        {t.fullName}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({t.role === "MAIN" ? "Chính" : "Phụ"})
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Chưa phân công</p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {c.presentToday == null ? (
                    <Badge variant="outline">Chưa điểm danh</Badge>
                  ) : (
                    <Badge variant="secondary">Hôm nay có mặt {c.presentToday}</Badge>
                  )}
                  {c.size > c.capacity && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Quá tải
                    </Badge>
                  )}
                </div>

                {canViewChildren && (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" className="min-h-11 flex-1">
                      <Link to={`/tre?classId=${c.id}`}>
                        Danh sách trẻ <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="secondary"
                      className="min-h-11"
                      aria-label={`Điểm danh lớp ${c.name}`}
                    >
                      <Link to={`/diem-danh?classId=${c.id}`}>
                        <ClipboardCheck className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Thêm lớp học" : "Sửa lớp học"}
        form={form}
        onSubmit={onSubmit}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField form={form} name="schoolId" label="Trường" required options={schoolOptions} />
            <SelectField form={form} name="schoolYearId" label="Năm học" required options={yearOptions} />
          </div>
          {yearOptions.length === 0 && canManage && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
              <span>Chưa có năm học nào.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleQuickCreateYear}
                disabled={creatingYear}
                className="h-7 text-xs min-h-7"
              >
                {creatingYear ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Tạo nhanh 2026–2027
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextField form={form} name="name" label="Tên lớp" required placeholder="Ví dụ: Mầm 1" />
            <SelectField form={form} name="ageGroupId" label="Khối" required options={ageGroupOptions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField form={form} name="room" label="Phòng học" placeholder="Ví dụ: P.101" />
            <TextField
              form={form}
              name="capacity"
              label="Sĩ số tối đa"
              type="number"
              inputMode="numeric"
              required
            />
          </div>

          {isCapacityExceeded && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <strong>Cảnh báo vượt sĩ số quy định:</strong> Sĩ số {watchedCapacity} vượt quá mức tối
                đa theo Điều lệ của khối {selectedGroup?.name} ({selectedGroup?.maxClassSize} trẻ).
              </div>
            </div>
          )}

          {isCurrentEnrollmentExceeded && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Cảnh báo vượt sĩ số hiện tại:</strong> Lớp đang có {editingClass?.size} trẻ đang
                học, vượt quá sĩ số tối đa mới đặt ({watchedCapacity}).
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SelectField form={form} name="mainTeacherId" label="Giáo viên chính" options={teacherOptions} />
            <SelectField
              form={form}
              name="assistantTeacherId"
              label="Giáo viên phụ"
              options={teacherOptions}
            />
          </div>
        </div>
      </FormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xóa vĩnh viễn lớp ${deleting?.name}?`}
        description="Thao tác này sẽ xóa hẳn lớp trống khỏi hệ thống và không thể hoàn tác."
        confirmText="Xóa lớp"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

