import { fakerVI as faker } from "@faker-js/faker";
import type { AgeGroup, ChildMark, Gender, TaskPriority, TaskStatus } from "./types";
import { DB_VERSION, type ClassRec, type ChildRec, type DemoDB, type LeaveRec, type StaffRec, type TaskRec } from "./db";
import { addDays, ageMonths, iso, isSchoolDay, isWorkDay, monthDays, monthOf, range, shiftMonthStr, weekStart, holidayName } from "./dates";
import { valueAt } from "./growth";

/** Seed cố định: mọi lần sinh (cùng ngày) cho cùng một bộ dữ liệu. */
const SEED = 20260930;

const MIDDLE_FEMALE = ["Thị", "Ngọc", "Thu", "Minh", "Thanh", "Phương", "Bảo", "Khánh"];
const MIDDLE_MALE = ["Văn", "Đức", "Minh", "Quang", "Gia", "Hoàng", "Bảo", "Anh"];
const NICKNAMES = ["Bin", "Bông", "Su", "Na", "Cún", "Mít", "Bơ", "Tôm", "Sóc", "Nấm", "Gấu", "Kem", "Bắp", "Xoài", "Mây", "Thỏ", "Chip", "Ken", "Cốm", "Bống", "Tít", "Đậu", "Sữa", "Mochi"];
const ALLERGIES = ["Dị ứng hải sản", "Dị ứng sữa bò", "Dị ứng trứng", "Dị ứng đậu phộng"];
const WARDS = [["00199", "Phường Láng"], ["00175", "Phường Yên Hòa"], ["00166", "Phường Cầu Giấy"], ["00160", "Phường Nghĩa Đô"], ["00235", "Phường Đống Đa"], ["00367", "Phường Thanh Xuân"], ["00364", "Phường Khương Đình"], ["00025", "Phường Giảng Võ"]];
const STREETS = ["Nguyễn Chí Thanh", "Láng Hạ", "Trần Duy Hưng", "Hoàng Quốc Việt", "Chùa Láng", "Nguyễn Trãi", "Lê Văn Lương", "Kim Mã", "Xuân Thủy", "Cầu Giấy"];

const CLASS_DEFS: { ageGroup: AgeGroup; prefix: string; capacity: number; fee: number }[] = [
  { ageGroup: "NHA_TRE", prefix: "Nhà trẻ", capacity: 20, fee: 4_200_000 },
  { ageGroup: "MAM", prefix: "Mầm", capacity: 25, fee: 3_900_000 },
  { ageGroup: "CHOI", prefix: "Chồi", capacity: 30, fee: 3_700_000 },
  { ageGroup: "LA", prefix: "Lá", capacity: 30, fee: 3_600_000 },
];
export const CLASS_FEE: Record<AgeGroup, number> = Object.fromEntries(CLASS_DEFS.map((c) => [c.ageGroup, c.fee])) as Record<AgeGroup, number>;
export const MEAL_PRICE = 35_000;
export const TALENT_FEE = 400_000;

const SCHOOL_DEFS = [
  { code: "MNV-HB", name: "Mầm Non Việt – Hoa Ban", address: "Số 18 Nguyễn Chí Thanh, phường Láng, Hà Nội", classes: ["Ong Vàng", "Thỏ Ngọc", "Họa Mi", "Sóc Nâu"] },
  { code: "MNV-SM", name: "Mầm Non Việt – Sen Mai", address: "Số 45 Lê Văn Lương, phường Yên Hòa, Hà Nội", classes: ["Cá Heo", "Bướm Xinh", "Sơn Ca", "Hướng Dương"] },
];

// Mỗi cơ sở 15 nhân viên
const STAFF_PLAN: { position: StaffRec["position"]; count: number }[] = [
  { position: "MANAGER", count: 2 },
  { position: "TEACHER", count: 8 },
  { position: "NURSE", count: 1 },
  { position: "COOK", count: 2 },
  { position: "ACCOUNTANT", count: 1 },
  { position: "SECURITY", count: 1 },
];

const BREAKFAST = ["Cháo thịt bằm cà rốt", "Phở gà", "Bún mọc", "Bánh cuốn chả", "Cháo tôm bí đỏ", "Miến gà", "Xôi gấc", "Bún riêu cua", "Súp gà ngô non", "Mì trứng thịt bò", "Cháo lươn", "Bánh mì trứng sữa"];
const MAINS = ["Thịt kho trứng cút", "Cá basa sốt cà chua", "Gà rim nấm", "Tôm rim thịt", "Đậu phụ nhồi thịt sốt cà", "Bò xào hành tây", "Trứng đúc thịt", "Thịt viên sốt cà chua", "Chả lá lốt", "Cá thu sốt cà", "Gà kho gừng", "Thịt lợn rim tiêu"];
const SOUPS = ["Canh bí đỏ nấu thịt", "Canh rau ngót thịt băm", "Canh cải nấu tôm", "Canh chua cá", "Canh mồng tơi cua đồng", "Canh bí xanh nấu tôm", "Canh khoai tây cà rốt sườn", "Canh cải cúc thịt băm"];
const VEGGIES = ["Su su xào", "Rau muống luộc", "Bắp cải xào", "Cải chíp xào tỏi", "Đậu cô ve xào", "Bí xanh luộc", "Cà rốt xào trứng"];
const SNACKS = ["Sữa chua", "Chè đậu xanh", "Bánh flan", "Chuối tiêu", "Sữa tươi, bánh quy", "Thanh long", "Hồng xiêm", "Váng sữa", "Đu đủ chín", "Chè khoai môn", "Bánh bông lan", "Nước cam"];

export const MENU_POOLS = { BREAKFAST, MAINS, SOUPS, VEGGIES, SNACKS };

const TASK_TITLES = [
  "Chuẩn bị hồ sơ kiểm tra an toàn thực phẩm", "Tổng vệ sinh lớp học cuối tuần", "Lập kế hoạch tổ chức Trung thu",
  "Kiểm tra đồ chơi ngoài trời", "Cập nhật sổ theo dõi sức khỏe trẻ", "Chuẩn bị họp phụ huynh đầu năm",
  "Trang trí góc thiên nhiên", "Kiểm kê đồ dùng học tập", "Báo cáo sĩ số tháng", "Tập huấn phòng cháy chữa cháy",
  "Chuẩn bị thực đơn tuần sau", "Rà soát hồ sơ trẻ mới nhập học", "Bảo dưỡng điều hòa phòng học", "Kiểm tra camera an ninh",
  "Dàn dựng tiết mục văn nghệ 20/11", "Lập danh sách trẻ tiêm chủng bổ sung", "Khám sức khỏe định kỳ cho trẻ",
  "Thay cát khu vui chơi", "In thông báo học phí tháng", "Cập nhật bảng tin phụ huynh",
];
const CHECKLIST = ["Lên danh sách việc cần làm", "Liên hệ nhà cung cấp", "Chụp ảnh gửi nhóm BGH", "Báo cáo kết quả", "Chuẩn bị vật tư", "Phân công người phụ trách"];
const COMMENTS = ["Em đã làm xong phần đầu, chiều nay hoàn thiện.", "Cần thêm kinh phí mua vật tư ạ.", "Đã liên hệ bên bảo trì, thứ Năm họ qua.", "Chị xem giúp em bản kế hoạch nhé."];
const REPLIES = ["Ok, em làm tiếp nhé.", "Chị đồng ý, em gửi dự trù kinh phí cho kế toán.", "Nhớ chụp ảnh gửi nhóm BGH nhé."];
const LEAVE_REASONS: Record<string, string[]> = {
  P: ["Việc gia đình", "Về quê có việc", "Đi khám sức khỏe định kỳ", "Đưa con đi tiêm phòng"],
  O: ["Bị sốt, đã đi khám", "Viêm họng, bác sĩ cho nghỉ", "Đau lưng cấp"],
  CO: ["Con ốm sốt", "Con bị viêm phế quản"],
  "1/2P": ["Chiều đi làm giấy tờ", "Sáng đưa con đi khám"],
};

function normal(): number {
  const u = 1 - faker.number.float({ min: 0, max: 1 });
  const v = faker.number.float({ min: 0, max: 1 });
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function personName(gender: Gender): string {
  const given = faker.person.firstName(gender === "FEMALE" ? "female" : "male").split(" ").pop()!;
  const middle = faker.helpers.arrayElement((gender === "FEMALE" ? MIDDLE_FEMALE : MIDDLE_MALE).filter((m) => m !== given));
  return `${faker.person.lastName()} ${middle} ${given}`;
}

function phone(): string {
  return `0${faker.helpers.arrayElement(["9", "8", "3", "7"])}${faker.string.numeric(8)}`;
}

function slug(name: string): string {
  const parts = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().split(" ");
  return parts[parts.length - 1] + parts.slice(0, -1).map((p) => p[0]).join("");
}

function address(): { detail: string; ward: string } {
  const [ward, wardName] = faker.helpers.arrayElement(WARDS);
  return { detail: `Số ${faker.number.int({ min: 2, max: 180 })} ${faker.helpers.arrayElement(STREETS)}`, ward: `${ward}|${wardName}` };
}

function dateBetween(from: string, to: string): string {
  const days = range(from, to);
  return faker.helpers.arrayElement(days);
}

function at(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(faker.number.int({ min: 0, max: 59 })).padStart(2, "0")}:00+07:00`;
}

export function workDaysBetween(from: string, to: string): number {
  return range(from, to).filter(isWorkDay).length;
}

export function generateDb(todayDate = new Date()): DemoDB {
  faker.seed(SEED);
  const today = iso(todayDate);
  const month = monthOf(today);
  const startDate = `${shiftMonthStr(month, -2)}-01`;
  const schoolYear = todayDate.getMonth() >= 7 ? todayDate.getFullYear() : todayDate.getFullYear() - 1;

  const db: DemoDB = {
    version: DB_VERSION,
    generatedOn: today,
    startDate,
    schools: [],
    users: {} as DemoDB["users"],
    staff: [],
    contracts: {},
    certificates: {},
    trainings: {},
    dependents: {},
    classes: [],
    children: [],
    childAttendance: {},
    childNotes: {},
    staffDays: {},
    late: {},
    discrepancies: {},
    cellNotes: {},
    locks: {},
    leaves: [],
    substitutions: [],
    tasks: [],
    invoices: [],
    menus: [],
    growth: [],
    notifications: [],
  };

  // ---- Cơ sở, nhân viên, lớp ----
  let staffNo = 0;
  let childNo = 0;
  SCHOOL_DEFS.forEach((def, schoolIndex) => {
    const school = { id: faker.string.uuid(), code: def.code, name: def.name, address: def.address };
    db.schools.push(school);
    const members: StaffRec[] = [];
    for (const { position, count } of STAFF_PLAN) {
      for (let i = 0; i < count; i++) {
        staffNo += 1;
        const gender: Gender = position === "SECURITY" || (position === "COOK" && i === 1) ? "MALE" : "FEMALE";
        const fullName = personName(gender);
        const addr = address();
        const [wardCode] = addr.ward.split("|");
        const startYear = position === "MANAGER" ? faker.number.int({ min: 2012, max: 2018 }) : faker.number.int({ min: 2016, max: 2025 });
        const rec: StaffRec = {
          id: faker.string.uuid(),
          staffCode: `NV${String(staffNo).padStart(3, "0")}`,
          machineCode: String(100 + staffNo),
          fullName,
          gender,
          dob: iso(faker.date.between({ from: `${position === "MANAGER" ? 1975 : 1985}-01-01`, to: "2002-12-31" })),
          phone: phone(),
          email: `${slug(fullName)}${staffNo}@mamnonviet.edu.vn`,
          citizenId: `001${gender === "FEMALE" ? "1" : "0"}${faker.string.numeric(8)}`,
          citizenIdIssuedOn: iso(faker.date.between({ from: "2021-01-01", to: "2024-12-31" })),
          ethnicity: "Kinh",
          qualification: position === "TEACHER" || position === "MANAGER" ? faker.helpers.arrayElement(["COLLEGE", "BACHELOR", "BACHELOR", "MASTER"]) : faker.helpers.arrayElement(["HIGH_SCHOOL", "INTERMEDIATE", "COLLEGE"]),
          specialization: position === "TEACHER" || position === "MANAGER" ? "Giáo dục mầm non" : position === "NURSE" ? "Điều dưỡng" : position === "COOK" ? "Kỹ thuật chế biến món ăn" : position === "ACCOUNTANT" ? "Kế toán" : undefined,
          permProvinceCode: "01",
          permWardCode: wardCode,
          permAddressDetail: addr.detail,
          currProvinceCode: "01",
          currWardCode: wardCode,
          currAddressDetail: addr.detail,
          socialInsuranceNo: faker.string.numeric(10),
          healthInsuranceNo: `GD401${faker.string.numeric(10)}`,
          personalTaxCode: faker.string.numeric(10),
          position,
          schoolId: school.id,
          schoolName: school.name,
          startDate: `${startYear}-${faker.helpers.arrayElement(["03", "06", "08", "09"])}-01`,
          status: "ACTIVE",
          bank: { bankName: faker.helpers.arrayElement(["Vietcombank", "BIDV", "Techcombank", "VietinBank", "MB Bank"]), bankAccountNo: faker.string.numeric(12), bankAccountHolder: fullName.toUpperCase() },
        };
        members.push(rec);
        db.staff.push(rec);

        const contractStart = rec.startDate;
        const indefinite = Number(contractStart.slice(0, 4)) < schoolYear - 3;
        const end = indefinite ? undefined : `${schoolYear + faker.number.int({ min: 0, max: 2 })}-${faker.helpers.arrayElement(["10", "12", "05", "08"])}-31`;
        db.contracts[rec.id] = [
          { id: faker.string.uuid(), contractNo: `${faker.string.numeric(3)}/HĐLĐ-MNV`, contractType: indefinite ? "INDEFINITE" : "DEFINITE", startDate: contractStart, endDate: end, signedOn: contractStart },
        ];
        db.certificates[rec.id] =
          position === "TEACHER" || position === "MANAGER"
            ? [{ id: faker.string.uuid(), name: "Chứng chỉ bồi dưỡng chức danh nghề nghiệp giáo viên mầm non", issuedBy: "Trường ĐHSP Hà Nội", issueDate: `${startYear}-06-15` }]
            : position === "COOK"
              ? [{ id: faker.string.uuid(), name: "Giấy xác nhận kiến thức an toàn thực phẩm", issuedBy: "Chi cục ATVSTP Hà Nội", issueDate: `${schoolYear - 1}-11-20`, expiryDate: `${schoolYear + 2}-11-20` }]
              : [];
        db.trainings[rec.id] = faker.datatype.boolean({ probability: 0.5 })
          ? [{ id: faker.string.uuid(), courseName: faker.helpers.arrayElement(["Sơ cấp cứu cho trẻ mầm non", "Phương pháp Montessori cơ bản", "Phòng chống bạo hành trẻ em", "Kỹ năng giao tiếp với phụ huynh"]), provider: "Sở GD&ĐT Hà Nội", startDate: `${schoolYear}-07-10`, endDate: `${schoolYear}-07-14`, result: "Đạt" }]
          : [];
        db.dependents[rec.id] = faker.datatype.boolean({ probability: 0.4 })
          ? [{ id: faker.string.uuid(), fullName: personName(faker.helpers.arrayElement(["MALE", "FEMALE"])), relationship: "Con", dob: iso(faker.date.between({ from: "2012-01-01", to: "2023-12-31" })), fromMonth: `${schoolYear - 1}-01` }]
          : [];
      }
    }

    const teachers = members.filter((m) => m.position === "TEACHER");
    def.classes.forEach((label, i) => {
      const c = CLASS_DEFS[i];
      const cls: ClassRec = {
        id: faker.string.uuid(),
        schoolId: school.id,
        name: `${c.prefix} – ${label}`,
        ageGroup: c.ageGroup,
        room: `P.${schoolIndex + 1}0${i + 1}`,
        capacity: c.capacity,
        teacherIds: [teachers[i * 2].id, teachers[i * 2 + 1].id],
      };
      db.classes.push(cls);
      const size = faker.number.int({ min: 23, max: 27 });
      const bornYear = schoolYear - [2, 3, 4, 5][i];
      for (let k = 0; k < size; k++) {
        childNo += 1;
        const gender: Gender = faker.datatype.boolean() ? "MALE" : "FEMALE";
        const guardianGender: Gender = faker.datatype.boolean({ probability: 0.75 }) ? "FEMALE" : "MALE";
        const addr = address();
        const child: ChildRec = {
          id: `c${String(childNo).padStart(3, "0")}`,
          code: `HS${schoolYear % 100}${String(childNo).padStart(4, "0")}`,
          schoolId: school.id,
          classId: cls.id,
          fullName: personName(gender),
          nickname: faker.helpers.arrayElement(NICKNAMES),
          gender,
          dob: iso(faker.date.between({ from: `${bornYear}-01-01`, to: `${bornYear}-${c.ageGroup === "NHA_TRE" ? "08" : "12"}-28` })),
          guardianName: personName(guardianGender),
          guardianRelation: guardianGender === "FEMALE" ? "Mẹ" : "Bố",
          guardianPhone: phone(),
          address: `${addr.detail}, ${addr.ward.split("|")[1]}, Hà Nội`,
          allergies: faker.datatype.boolean({ probability: 0.08 }) ? faker.helpers.arrayElement(ALLERGIES) : undefined,
          healthNote: faker.datatype.boolean({ probability: 0.05 }) ? "Hay viêm họng, cần giữ ấm" : undefined,
          enrolledOn: `${faker.number.int({ min: bornYear + 2, max: schoolYear })}-08-${faker.helpers.arrayElement(["05", "15", "25"])}`,
        };
        if (child.enrolledOn > `${schoolYear}-08-25`) child.enrolledOn = `${schoolYear}-08-25`;
        db.children.push(child);
      }
    });

    const managers = members.filter((m) => m.position === "MANAGER");
    if (schoolIndex === 0) {
      db.users.principal = { staffId: managers[0].id, grants: [] };
      db.users.vice = { staffId: managers[1].id, grants: [{ role: "VICE_PRINCIPAL", schoolId: school.id }] };
      db.users.teacher = { staffId: teachers[6].id, grants: [{ role: "TEACHER", schoolId: school.id }] };
    }
    // Hiệu trưởng demo phụ trách cả hai cơ sở để thấy bộ chọn cơ sở
    db.users.principal.grants.push({ role: "PRINCIPAL", schoolId: school.id });
  });

  // ---- Điểm danh trẻ ----
  // Mỗi trẻ có xác suất vắng riêng: vắng có phép 2–9%, không phép 0,5–2,5%
  const tendency = new Map(db.children.map((c) => [c.id, { e: faker.number.float({ min: 0.02, max: 0.09 }), a: faker.number.float({ min: 0.005, max: 0.025 }) }]));
  const schoolDays = range(startDate, today).filter(isSchoolDay);
  const lateClass = db.classes[3].id; // lớp chưa điểm danh hôm nay
  for (const date of schoolDays) {
    const marks: Record<string, ChildMark> = {};
    for (const child of db.children) {
      if (child.enrolledOn > date) continue;
      if (date === today && child.classId === lateClass) continue;
      const r = faker.number.float({ min: 0, max: 1 });
      const t = tendency.get(child.id)!;
      marks[child.id] = r < t.a ? "A" : r < t.a + t.e ? "E" : "P";
    }
    db.childAttendance[date] = marks;
  }
  const absentToday = Object.entries(db.childAttendance[today] ?? {}).filter(([, m]) => m !== "P");
  for (const [childId, mark] of absentToday.slice(0, 4)) {
    db.childNotes[`${childId}|${today}`] = mark === "E" ? faker.helpers.arrayElement(["Phụ huynh báo bé sốt", "Bé về quê", "Bé đi khám răng"]) : "Chưa liên lạc được phụ huynh";
  }

  // ---- Nghỉ phép ----
  const byId = new Map(db.staff.map((s) => [s.id, s]));
  const principalName = byId.get(db.users.principal.staffId)!.fullName;
  const addLeave = (staff: StaffRec, code: string, from: string, to: string, status: LeaveRec["status"], halfDay = false) => {
    const leave: LeaveRec = {
      id: faker.string.uuid(),
      schoolId: staff.schoolId,
      staffId: staff.id,
      leaveCode: code.replace("1/2", ""),
      fromDate: from,
      toDate: to,
      halfDay,
      days: halfDay ? 0.5 : workDaysBetween(from, to),
      reason: faker.helpers.arrayElement(LEAVE_REASONS[code] ?? LEAVE_REASONS.P),
      status,
      createdAt: at(addDays(from, -faker.number.int({ min: 1, max: 5 })), 9),
    };
    if (status === "APPROVED" || status === "REJECTED") {
      leave.reviewedAt = at(addDays(leave.createdAt.slice(0, 10), 1), 10);
      leave.reviewerName = principalName;
      if (status === "REJECTED") leave.reviewNote = "Trùng lịch kiểm tra của Phòng GD, bạn sắp xếp ngày khác nhé.";
    }
    db.leaves.push(leave);
    return leave;
  };
  for (const staff of db.staff) {
    if (staff.id === db.users.principal.staffId) continue;
    const count = faker.number.int({ min: 0, max: 2 });
    for (let i = 0; i < count; i++) {
      const from = dateBetween(startDate, addDays(today, -7));
      if (!isWorkDay(from)) continue;
      const code = faker.helpers.weightedArrayElement([{ value: "P", weight: 5 }, { value: "O", weight: 2 }, { value: "CO", weight: 2 }, { value: "1/2P", weight: 1 }]);
      const len = code === "1/2P" ? 0 : code === "O" ? faker.number.int({ min: 0, max: 2 }) : 0;
      let to = addDays(from, len);
      while (!isWorkDay(to)) to = addDays(to, -1);
      if (db.leaves.some((l) => l.staffId === staff.id && l.fromDate <= to && l.toDate >= from)) continue;
      addLeave(staff, code, from, to, faker.datatype.boolean({ probability: 0.92 }) ? "APPROVED" : "REJECTED", code === "1/2P");
    }
  }
  // Hôm nay: cơ sở 1 có 1 GV nghỉ chưa có người thay, 1 cấp dưỡng nghỉ; cơ sở 2 có 1 GV nghỉ đã có người thay
  const [schoolA, schoolB] = db.schools;
  const staffOf = (schoolId: string, position: string) => db.staff.filter((s) => s.schoolId === schoolId && s.position === position);
  const workToday = isWorkDay(today) ? today : addDays(today, 1);
  const teacherA = staffOf(schoolA.id, "TEACHER")[2];
  const cookA = staffOf(schoolA.id, "COOK")[1];
  const teacherB = staffOf(schoolB.id, "TEACHER")[5];
  for (const s of [teacherA, cookA, teacherB]) db.leaves = db.leaves.filter((l) => l.staffId !== s.id || l.toDate < addDays(today, -3));
  addLeave(teacherA, "O", workToday, workToday, "APPROVED");
  addLeave(cookA, "P", workToday, workToday, "APPROVED");
  addLeave(teacherB, "P", workToday, addDays(workToday, 1), "APPROVED");
  const nurseB = staffOf(schoolB.id, "NURSE")[0];
  db.substitutions.push({ id: faker.string.uuid(), schoolId: schoolB.id, date: workToday, classId: db.classes.find((c) => c.teacherIds.includes(teacherB.id))!.id, absentStaffId: teacherB.id, staffId: nurseB.id });
  // Đơn chờ duyệt
  const pendingPlan: [string, string, string, number, number][] = [
    [schoolA.id, "TEACHER", "P", 0, 1],
    [schoolA.id, "TEACHER", "CO", 4, 2],
    [schoolA.id, "ACCOUNTANT", "P", 0, 7],
    [schoolB.id, "TEACHER", "P", 3, 3],
    [schoolB.id, "SECURITY", "1/2P", 0, 2],
  ];
  for (const [schoolId, position, code, index, offset] of pendingPlan) {
    const staff = staffOf(schoolId, position)[index];
    let from = addDays(today, offset);
    while (!isWorkDay(from)) from = addDays(from, 1);
    const leave = addLeave(staff, code, from, from, "PENDING", code === "1/2P");
    leave.createdAt = at(addDays(today, -faker.number.int({ min: 0, max: 1 })), 8);
  }

  // ---- Chấm công nhân viên ----
  const workDays = range(startDate, today).filter((d) => isWorkDay(d) || holidayName(d));
  for (const staff of db.staff) {
    const days: Record<string, string> = {};
    for (const date of workDays) {
      if (holidayName(date)) {
        days[date] = "NL";
        continue;
      }
      days[date] = "X";
      if (faker.datatype.boolean({ probability: 0.04 })) {
        const minutes = faker.number.int({ min: 3, max: 35 });
        db.late[`${staff.id}|${date}`] = minutes;
      }
      if (monthOf(date) === month && date < today && faker.datatype.boolean({ probability: 0.008 })) {
        db.discrepancies[`${staff.id}|${date}`] = { reason: "Thiếu giờ ra", suggested: "X" };
      }
    }
    db.staffDays[staff.id] = days;
  }
  for (const leave of db.leaves.filter((l) => l.status === "APPROVED")) {
    for (const date of range(leave.fromDate, leave.toDate)) {
      if (date > today || !isWorkDay(date)) continue;
      db.staffDays[leave.staffId][date] = leave.halfDay ? `1/2${leave.leaveCode}` : leave.leaveCode;
      delete db.late[`${leave.staffId}|${date}`];
    }
  }
  for (const school of db.schools) {
    for (const m of [shiftMonthStr(month, -2), shiftMonthStr(month, -1)]) {
      db.locks[`${school.id}|${m}`] = { lockedAt: `${shiftMonthStr(m, 1)}-03T16:30:00+07:00`, lockedByName: principalName };
    }
  }

  // ---- Công việc ----
  for (const school of db.schools) {
    const members = db.staff.filter((s) => s.schoolId === school.id);
    const creator = members.find((m) => m.position === "MANAGER")!;
    const titles = faker.helpers.shuffle([...TASK_TITLES]).slice(0, 14);
    const statuses: TaskStatus[] = ["NEW", "NEW", "NEW", "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", "WAITING_APPROVAL", "WAITING_APPROVAL", "WAITING_APPROVAL", "DONE", "DONE", "DONE", "DONE"];
    titles.forEach((title, i) => {
      const status = statuses[i];
      const assignees = faker.helpers.arrayElements(members.filter((m) => m.position !== "MANAGER" || i % 5 === 0), { min: 1, max: 2 });
      if (school.id === schoolA.id && i < 3) assignees[0] = byId.get(db.users.teacher.staffId)!;
      const checklist = faker.helpers.arrayElements(CHECKLIST, { min: 0, max: 4 }).map((content, k) => ({
        id: faker.string.uuid(),
        content,
        done: status === "DONE" || status === "WAITING_APPROVAL" || (status === "IN_PROGRESS" && k === 0),
      }));
      const task: TaskRec = {
        id: faker.string.uuid(),
        schoolId: school.id,
        title,
        description: `${title}. Hoàn thành trước hạn và cập nhật kết quả vào mục bình luận.`,
        priority: faker.helpers.weightedArrayElement<TaskPriority>([{ value: "LOW", weight: 2 }, { value: "MEDIUM", weight: 4 }, { value: "HIGH", weight: 3 }, { value: "URGENT", weight: 1 }]),
        status,
        dueDate: status === "DONE" ? addDays(today, -faker.number.int({ min: 1, max: 20 })) : addDays(today, faker.number.int({ min: i % 4 === 0 ? -4 : 0, max: 14 })),
        assigneeIds: [...new Set(assignees.map((a) => a.id))],
        createdById: school.id === schoolA.id ? db.users.principal.staffId : creator.id,
        createdAt: at(addDays(today, -faker.number.int({ min: 3, max: 30 })), 8),
        checklist,
        comments: status === "NEW" ? [] : [faker.helpers.arrayElement(COMMENTS), faker.helpers.arrayElement(REPLIES)].slice(0, faker.number.int({ min: 0, max: 2 })).map((body, k) => ({
          id: faker.string.uuid(),
          author: k === 0 ? assignees[0].fullName : creator.fullName,
          body,
          at: at(addDays(today, -faker.number.int({ min: 0, max: 3 })), 14),
        })),
      };
      db.tasks.push(task);
    });
  }

  // ---- Học phí ----
  const classById = new Map(db.classes.map((c) => [c.id, c]));
  const months = [shiftMonthStr(month, -2), shiftMonthStr(month, -1), month];
  let invoiceNo = 0;
  for (const m of months) {
    const mealDays = monthDays(m).filter(isSchoolDay).length;
    const prev = shiftMonthStr(m, -1);
    for (const child of db.children) {
      if (child.enrolledOn > `${m}-28`) continue;
      const cls = classById.get(child.classId)!;
      const lines = [
        { name: "Học phí", amount: CLASS_FEE[cls.ageGroup] },
        { name: `Tiền ăn (${mealDays} ngày × ${MEAL_PRICE.toLocaleString("vi-VN")} ₫)`, amount: mealDays * MEAL_PRICE },
      ];
      const excused = Object.entries(db.childAttendance).filter(([d, marks]) => monthOf(d) === prev && marks[child.id] === "E").length;
      if (excused > 0) lines.push({ name: `Hoàn tiền ăn ${excused} ngày nghỉ có phép tháng trước`, amount: -excused * MEAL_PRICE });
      if (Number(child.id.slice(1)) % 5 < 2) lines.push({ name: "Năng khiếu (tiếng Anh)", amount: TALENT_FEE });
      const total = lines.reduce((sum, l) => sum + l.amount, 0);
      invoiceNo += 1;
      const current = m === month;
      const roll = faker.number.float({ min: 0, max: 1 });
      const paid = current ? (roll < 0.62 ? total : roll < 0.68 ? Math.round(total / 2 / 1000) * 1000 : 0) : roll < 0.9 ? total : roll < 0.95 ? Math.round(total / 2 / 1000) * 1000 : 0;
      const payDay = dateBetween(`${m}-02`, current ? (today < `${m}-12` ? today : `${m}-12`) : `${m}-15`);
      db.invoices.push({
        id: faker.string.uuid(),
        code: `PT${m.replace("-", "").slice(2)}-${String(invoiceNo).padStart(4, "0")}`,
        schoolId: child.schoolId,
        childId: child.id,
        month: m,
        dueDate: `${m}-10`,
        lines,
        payments: paid > 0 ? [{ id: faker.string.uuid(), date: payDay, amount: paid, method: faker.datatype.boolean({ probability: 0.7 }) ? "TRANSFER" : "CASH" }] : [],
      });
    }
  }

  // ---- Thực đơn ----
  for (const school of db.schools) {
    for (let ws = weekStart(startDate); ws <= addDays(weekStart(today), 7); ws = addDays(ws, 7)) {
      db.menus.push({
        id: faker.string.uuid(),
        schoolId: school.id,
        weekStart: ws,
        days: [0, 1, 2, 3, 4].map((k) => ({
          date: addDays(ws, k),
          breakfast: faker.helpers.arrayElement(BREAKFAST),
          lunch: [faker.helpers.arrayElement(MAINS), faker.helpers.arrayElement(SOUPS), faker.helpers.arrayElement(VEGGIES), "Cơm trắng"],
          snack: faker.helpers.arrayElement(SNACKS),
        })),
      });
    }
  }

  // ---- Cân đo (mỗi tháng một lần) ----
  for (const child of db.children) {
    const zw = normal() * 0.9 + (faker.datatype.boolean({ probability: 0.05 }) ? -1.6 : faker.datatype.boolean({ probability: 0.05 }) ? 1.8 : 0);
    const zh = normal() * 0.9;
    for (const m of months) {
      const date = `${m}-${String(faker.number.int({ min: 8, max: 12 })).padStart(2, "0")}`;
      if (date > today) continue;
      const age = ageMonths(child.dob, date);
      db.growth.push({
        id: faker.string.uuid(),
        childId: child.id,
        date,
        heightCm: +valueAt("height", child.gender, age, zh).toFixed(1),
        weightKg: +valueAt("weight", child.gender, age, zw + normal() * 0.05).toFixed(1),
      });
    }
  }

  // ---- Thông báo ----
  const teacherUser = byId.get(db.users.teacher.staffId)!;
  db.notifications.push(
    { id: faker.string.uuid(), staffId: db.users.principal.staffId, title: "Có đơn nghỉ mới chờ duyệt", body: "Mở Hộp duyệt để xem các đơn nghỉ.", link: "/hop-duyet", createdAt: at(today, 7) },
    { id: faker.string.uuid(), staffId: db.users.principal.staffId, title: "Việc chờ duyệt", body: "Có việc đã hoàn thành chờ bạn xác nhận.", link: "/hop-duyet", createdAt: at(addDays(today, -1), 16) },
    { id: faker.string.uuid(), staffId: teacherUser.id, title: "Bạn được giao việc mới", body: "Kiểm tra mục Công việc.", link: "/cong-viec", createdAt: at(addDays(today, -1), 9) },
  );

  return db;
}
