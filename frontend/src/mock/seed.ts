import { fakerVI as faker } from "@faker-js/faker";
import {
  type AgeGroup,
  type ChildMark,
  type ChildRec,
  type ClassRec,
  DB_VERSION,
  type DemoDB,
  type Gender,
  type LeaveRec,
  type StaffRec,
  type TaskPriority,
  type TaskRec,
  type TaskStatus,
} from "./db";
import { addDays, ageMonths, iso, isSchoolDay, isWorkDay, monthDays, monthOf, range, shiftMonthStr, weekStart, weekday, holidayName } from "./dates";
import { amountDue, generate as generateInvoices, issue as issueInvoices, pay as payInvoice, PAYROLL_CATEGORY_ID, TUITION_CATEGORY_ID } from "./finance";
import { ageInMonths, classify, valueAt } from "./growth";

/** Seed cố định: mọi lần sinh (cùng ngày) cho cùng một bộ dữ liệu. */
const SEED = 20260930;

const MIDDLE_FEMALE = ["Thị", "Ngọc", "Thu", "Minh", "Thanh", "Phương", "Bảo", "Khánh"];
const MIDDLE_MALE = ["Văn", "Đức", "Minh", "Quang", "Gia", "Hoàng", "Bảo", "Anh"];
const NICKNAMES = ["Bin", "Bông", "Su", "Na", "Cún", "Mít", "Bơ", "Tôm", "Sóc", "Nấm", "Gấu", "Kem", "Bắp", "Xoài", "Mây", "Thỏ", "Chip", "Ken", "Cốm", "Bống", "Tít", "Đậu", "Sữa", "Mochi"];
const ALLERGIES = ["Dị ứng tôm, cua", "Dị ứng sữa bò", "Dị ứng trứng", "Dị ứng đậu phộng"];
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

const AGE_GROUP_DEFS: { code: AgeGroup; name: string; minMonths: number; maxMonths: number; maxClassSize: number }[] = [
  { code: "NHA_TRE", name: "Nhà trẻ (24–36 tháng)", minMonths: 24, maxMonths: 36, maxClassSize: 25 },
  { code: "MAM", name: "Mẫu giáo bé (3–4 tuổi)", minMonths: 36, maxMonths: 48, maxClassSize: 25 },
  { code: "CHOI", name: "Mẫu giáo nhỡ (4–5 tuổi)", minMonths: 48, maxMonths: 60, maxClassSize: 30 },
  { code: "LA", name: "Mẫu giáo lớn (5–6 tuổi)", minMonths: 60, maxMonths: 72, maxClassSize: 35 },
];
const FEE_TYPE_DEFS = [
  { id: "ft-tuition", code: "HOC_PHI", name: "Học phí", calcMethod: "MONTHLY", refundableOnAbsence: false },
  { id: "ft-meal", code: "TIEN_AN", name: "Tiền ăn", calcMethod: "PER_DAY", refundableOnAbsence: true },
  { id: "ft-facility", code: "CSVC", name: "Cơ sở vật chất", calcMethod: "ONE_TIME", refundableOnAbsence: false },
  { id: "ft-english", code: "TIENG_ANH", name: "Năng khiếu tiếng Anh", calcMethod: "OPTIONAL", refundableOnAbsence: false },
  { id: "ft-bus", code: "XE_DUA_DON", name: "Xe đưa đón", calcMethod: "OPTIONAL", refundableOnAbsence: false },
] as const;
const CASH_CATEGORY_DEFS: { id?: string; name: string; direction: "IN" | "OUT" }[] = [
  { id: TUITION_CATEGORY_ID, name: "Thu học phí", direction: "IN" },
  { name: "Thu bán đồng phục", direction: "IN" },
  { name: "Thu khác", direction: "IN" },
  { id: PAYROLL_CATEGORY_ID, name: "Chi lương", direction: "OUT" },
  { name: "Thực phẩm", direction: "OUT" },
  { name: "Điện, nước, internet", direction: "OUT" },
  { name: "Văn phòng phẩm, đồ dùng", direction: "OUT" },
  { name: "Sửa chữa, bảo trì", direction: "OUT" },
  { name: "Chi khác", direction: "OUT" },
];
const FOOD_SUPPLIERS = ["Công ty Thực phẩm sạch Hà Nội", "HTX rau an toàn Văn Đức", "Cửa hàng thịt Hòa Phát"];
const formatDay = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;

const SCHOOL_DEFS = [
  { code: "PBC", name: "Trường MN Phan Bội Châu", type: "MAIN" as const, provinceCode: "31", wardCode: "11311", addressDetail: "85 Quang Trung", classes: ["Ong Vàng", "Thỏ Ngọc", "Họa Mi", "Sóc Nâu"] },
  { code: "PBC-PH1", name: "Trường MN Phan Bội Châu – Phân hiệu 1", type: "BRANCH" as const, parentCode: "PBC", provinceCode: "31", wardCode: "11311", addressDetail: "134 Hạ Lý", classes: ["Cá Heo", "Bướm Xinh", "Sơn Ca", "Hướng Dương"] },
  { code: "PBC-PH2", name: "Trường MN Phan Bội Châu – Phân hiệu 2", type: "BRANCH" as const, parentCode: "PBC", provinceCode: "31", wardCode: "11311", addressDetail: "191 Phan Bội Châu", classes: ["Mặt Trời", "Cầu Vồng", "Sao Mai", "Măng Non"] },
] as const;

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
const INGREDIENT_WORDS: [RegExp, string][] = [
  [/tôm/i, "Tôm"], [/cua/i, "Cua đồng"], [/cá|lươn/i, "Cá"], [/trứng/i, "Trứng gà"], [/sữa|flan|váng/i, "Sữa bò"],
  [/bò/i, "Thịt bò"], [/gà/i, "Thịt gà"], [/thịt|chả|sườn|viên/i, "Thịt lợn"], [/đậu phụ/i, "Đậu phụ"], [/đậu xanh/i, "Đậu xanh"],
  [/cháo|cơm|xôi/i, "Gạo"], [/bún|phở|miến|mì|bánh/i, "Bột gạo, bột mì"],
];

/** Nguyên liệu suy từ tên món (đủ để demo cảnh báo dị ứng). */
function dishIngredients(name: string): { name: string; grams: number }[] {
  const found = INGREDIENT_WORDS.filter(([re]) => re.test(name)).map(([, ingredient]) => ingredient);
  return [...new Set(found.length ? found : [name])].map((n) => ({ name: n, grams: faker.number.int({ min: 10, max: 60 }) }));
}

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

/** Một ngày bất kỳ trong khoảng; khoảng rỗng (đầu tháng, ngày lễ) thì lấy ngày đầu. */
function dateBetween(from: string, to: string): string {
  const days = range(from, to);
  return days.length ? faker.helpers.arrayElement(days) : from;
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
    schoolYears: [],
    ageGroups: [],
    feeTypes: [],
    feeSchedules: [],
    financeConfigs: [],
    feeItems: [],
    discounts: [],
    invoices: [],
    cashCategories: [],
    cashEntries: [],
    accounts: [],
    dishes: [],
    menus: [],
    menuItems: [],
    measurements: [],
    healthLogs: [],
    checkups: [],
    notifications: [],
  };

  // ---- Cơ sở, nhân viên, lớp ----
  let staffNo = 0;
  let childNo = 0;
  SCHOOL_DEFS.forEach((def, schoolIndex) => {
    const school = {
      id: faker.string.uuid(),
      code: def.code,
      name: def.name,
      type: def.type,
      parentId: def.type === "BRANCH" ? db.schools.find((item) => item.code === def.parentCode)!.id : undefined,
      provinceCode: def.provinceCode,
      wardCode: def.wardCode,
      addressDetail: def.addressDetail,
    };
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
          startDate: iso(faker.date.between({ from: `${startYear}-01-05`, to: `${startYear}-11-30` })),
          status: "ACTIVE",
          bank: { bankName: faker.helpers.arrayElement(["Vietcombank", "BIDV", "Techcombank", "VietinBank", "MB Bank"]), bankAccountNo: faker.string.numeric(12), bankAccountHolder: fullName.toUpperCase() },
        };
        members.push(rec);
        db.staff.push(rec);

        const contractStart = rec.startDate;
        const indefinite = Number(contractStart.slice(0, 4)) < schoolYear - 4;
        // Vài hợp đồng sắp hết hạn để thấy cảnh báo "Giấy tờ sắp hết hạn"
        const end = indefinite
          ? undefined
          : staffNo % 4 === 0
            ? addDays(today, faker.number.int({ min: 8, max: 28 }))
            : `${schoolYear + faker.number.int({ min: 1, max: 2 })}-${faker.helpers.arrayElement(["10", "12", "05", "08"])}-31`;
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
          // Phần lớn trẻ học từ năm trước; khoảng 15% mới nhập học tháng 8 năm nay
          enrolledOn: `${faker.datatype.boolean({ probability: 0.15 }) ? schoolYear : faker.number.int({ min: Math.min(bornYear + 1, schoolYear - 1), max: schoolYear - 1 })}-08-${faker.helpers.arrayElement(["05", "15", "25"])}`,
        };
        if (child.enrolledOn > `${schoolYear}-08-25`) child.enrolledOn = `${schoolYear}-08-25`;
        db.children.push(child);
      }
    });

    const managers = members.filter((m) => m.position === "MANAGER");
    if (schoolIndex === 0) {
      db.users.principal = { staffId: managers[0].id, grants: [] };
      db.users.vice = {
        staffId: managers[1].id,
        grants: [{ role: "VICE_PRINCIPAL", schoolId: school.id, functionGroups: ["CLASSROOM", "NUTRITION", "HR", "REPORTS"] }],
      };
      db.users.teacher = { staffId: teachers[6].id, grants: [{ role: "TEACHER", schoolId: school.id }] };
    }
    // Hiệu trưởng demo quản lý mọi trường (toàn quyền, kể cả học phí, lương) để thấy bộ chọn trường
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
  for (const y of [schoolYear - 1, schoolYear]) {
    db.schoolYears.push({ id: `sy-${y}`, name: `${y}–${y + 1}`, startDate: `${y}-08-01`, endDate: `${y + 1}-07-31`, current: y === schoolYear });
  }
  db.ageGroups = AGE_GROUP_DEFS.map((a) => ({ id: `ag-${a.code}`, ...a }));
  db.feeTypes = FEE_TYPE_DEFS.map((f, i) => ({ ...f, orderNo: i + 1, active: true }));
  db.financeConfigs.push({ id: "cfg-chain", effectiveFrom: `${schoolYear - 1}-08-01`, dueDay: 10, mealRefundRule: "BEFORE_CUTOFF", proration: "FULL_MONTH" });
  db.schools.forEach((school, schoolIndex) => {
    for (const year of db.schoolYears) {
      const schedule = (feeTypeId: string, amount: number, ageGroupId?: string) =>
        db.feeSchedules.push({
          id: faker.string.uuid(),
          schoolId: school.id,
          schoolYearId: year.id,
          feeTypeId,
          feeTypeName: db.feeTypes.find((f) => f.id === feeTypeId)!.name,
          calcMethod: db.feeTypes.find((f) => f.id === feeTypeId)!.calcMethod,
          ageGroupId,
          ageGroupName: db.ageGroups.find((a) => a.id === ageGroupId)?.name,
          amount,
          effectiveFrom: year.startDate,
        });
      for (const a of db.ageGroups) schedule("ft-tuition", CLASS_FEE[a.code] + schoolIndex * 100_000, a.id);
      schedule("ft-meal", MEAL_PRICE);
      schedule("ft-facility", 1_200_000);
      schedule("ft-english", TALENT_FEE);
      schedule("ft-bus", 800_000);
    }
  });
  for (const child of db.children) {
    const n = Number(child.id.slice(1));
    const from = `${schoolYear}-08-01`;
    if (n % 5 < 2) db.feeItems.push({ id: faker.string.uuid(), childId: child.id, feeTypeId: "ft-english", feeTypeName: "Năng khiếu tiếng Anh", fromMonth: `${schoolYear - 1}-08-01` });
    if (n % 7 === 0) db.feeItems.push({ id: faker.string.uuid(), childId: child.id, feeTypeId: "ft-bus", feeTypeName: "Xe đưa đón", fromMonth: from });
    if (n % 11 === 0) db.discounts.push({ id: faker.string.uuid(), childId: child.id, feeTypeId: "ft-tuition", feeTypeName: "Học phí", percent: 10, reason: "Con thứ hai trong gia đình", fromMonth: from });
    else if (n % 17 === 0) db.discounts.push({ id: faker.string.uuid(), childId: child.id, amount: 500_000, reason: "Con cán bộ, giáo viên", fromMonth: from });
  }
  db.cashCategories = CASH_CATEGORY_DEFS.map((c, i) => ({ id: c.id ?? `cat-${i}`, name: c.name, direction: c.direction, system: !!c.id, active: true, orderNo: i + 1 }));

  const cashier = db.staff.find((s) => s.id === db.users.principal.staffId)!.fullName;
  for (const m of [shiftMonthStr(month, -2), shiftMonthStr(month, -1), month]) {
    const current = m === month;
    for (const school of db.schools) {
      generateInvoices(db, school.id, m, () => faker.string.uuid());
      issueInvoices(db, db.invoices.filter((i) => i.schoolId === school.id && i.periodMonth === `${m}-01` && i.status === "DRAFT"), `${m}-01T08:30:00+07:00`);
    }
    for (const inv of db.invoices.filter((i) => i.periodMonth === `${m}-01`)) {
      const due = amountDue(inv);
      const roll = faker.number.float({ min: 0, max: 1 });
      const half = Math.round(due / 2 / 1000) * 1000;
      const paid = current ? (roll < 0.62 ? due : roll < 0.68 ? half : 0) : roll < 0.9 ? due : roll < 0.95 ? half : 0;
      if (paid <= 0) continue;
      // Tháng hiện tại chỉ thu tới hôm nay; đầu tháng thì rơi về chính ngày bắt đầu
      const paidOn = dateBetween(`${m}-01`, current ? (today < `${m}-12` ? today : `${m}-12`) : `${m}-15`);
      const method = faker.datatype.boolean({ probability: 0.7 }) ? "TRANSFER" : "CASH";
      payInvoice(db, inv, { id: faker.string.uuid(), amount: paid, method, paidOn, reference: method === "TRANSFER" ? `FT${faker.string.numeric(10)}` : undefined, receivedByName: cashier });
    }
    for (const school of db.schools) {
      const out = (categoryIndex: number, entryDate: string, amount: number, description: string, source: "MANUAL" | "PAYROLL" = "MANUAL") => {
        if (entryDate > today) return;
        const category = db.cashCategories[categoryIndex];
        db.cashEntries.push({ id: faker.string.uuid(), schoolId: school.id, categoryId: category.id, categoryName: category.name, direction: category.direction, source, amount, entryDate, description, createdByName: cashier });
      };
      const outIndex = (name: string) => db.cashCategories.findIndex((c) => c.name === name);
      for (const day of monthDays(m).filter((d) => weekday(d) === 1)) {
        out(outIndex("Thực phẩm"), day, faker.number.int({ min: 90, max: 130 }) * 100_000, `Thực phẩm tuần ${formatDay(day)} (${faker.helpers.arrayElement(FOOD_SUPPLIERS)})`);
      }
      out(outIndex("Điện, nước, internet"), `${m}-05`, faker.number.int({ min: 55, max: 85 }) * 100_000, `Tiền điện, nước, internet tháng ${Number(shiftMonthStr(m, -1).slice(5))}`);
      out(outIndex("Chi lương"), `${m}-05`, faker.number.int({ min: 1650, max: 1850 }) * 100_000, `Lương tháng ${Number(shiftMonthStr(m, -1).slice(5))}`, "PAYROLL");
      out(outIndex("Văn phòng phẩm, đồ dùng"), dateBetween(`${m}-08`, `${m}-20`), faker.number.int({ min: 8, max: 30 }) * 100_000, faker.helpers.arrayElement(["Giấy A4, bút, mực in", "Đồ dùng học tập lớp", "Bột màu, đất nặn, giấy thủ công"]));
      if (faker.datatype.boolean({ probability: 0.6 })) out(outIndex("Sửa chữa, bảo trì"), dateBetween(`${m}-10`, `${m}-25`), faker.number.int({ min: 10, max: 60 }) * 100_000, faker.helpers.arrayElement(["Sửa điều hòa phòng lớp", "Thay bóng đèn, ổ cắm", "Bảo trì cầu trượt sân chơi"]));
      out(outIndex("Thu bán đồng phục"), dateBetween(`${m}-02`, `${m}-10`), faker.number.int({ min: 10, max: 40 }) * 250_000, "Bán đồng phục cho trẻ mới");
    }
  }

  // ---- Món ăn, thực đơn (chung mọi khối, công bố trước tuần hiện tại) ----
  const pools = { BREAKFAST, MAINS, SOUPS, VEGGIES, SNACKS };
  const dishIds = new Map<string, string>();
  for (const name of [...BREAKFAST, ...MAINS, ...SOUPS, ...VEGGIES, ...SNACKS, "Cơm trắng"]) {
    if (dishIds.has(name)) continue;
    const id = faker.string.uuid();
    dishIds.set(name, id);
    const lunch = MAINS.includes(name);
    db.dishes.push({
      id,
      shared: true,
      name,
      ingredients: dishIngredients(name),
      kcal: lunch ? faker.number.int({ min: 120, max: 180 }) : faker.number.int({ min: 60, max: 260 }),
      proteinG: faker.number.int({ min: 2, max: 15 }),
      fatG: faker.number.int({ min: 1, max: 10 }),
      carbG: faker.number.int({ min: 3, max: 45 }),
      active: true,
    });
  }
  for (const school of db.schools) {
    for (let ws = weekStart(startDate); ws <= addDays(weekStart(today), 7); ws = addDays(ws, 7)) {
      // Không lặp món trong một tuần
      const [breakfast, mains, soups, veggies, snacks] = (Object.keys(pools) as (keyof typeof pools)[]).map((k) => faker.helpers.arrayElements(pools[k], 5));
      const menuId = faker.string.uuid();
      db.menus.push({ id: menuId, schoolId: school.id, weekStart: ws, status: ws <= weekStart(today) ? "PUBLISHED" : "DRAFT", publishedAt: ws <= weekStart(today) ? at(addDays(ws, -3), 9) : undefined });
      for (let k = 0; k < 5; k++) {
        const date = addDays(ws, k);
        const add = (meal: "BREAKFAST" | "LUNCH" | "AFTERNOON", name: string, orderNo: number) =>
          db.menuItems.push({ id: faker.string.uuid(), menuId, date, meal, dishId: dishIds.get(name)!, orderNo });
        add("BREAKFAST", breakfast[k], 1);
        add("LUNCH", "Cơm trắng", 1);
        add("LUNCH", mains[k], 2);
        add("LUNCH", soups[k], 3);
        add("LUNCH", veggies[k], 4);
        add("AFTERNOON", snacks[k], 1);
      }
    }
  }

  // ---- Cân đo (mỗi tháng một lần, kênh theo chuẩn WHO) ----
  const recorder = byId.get(db.users.principal.staffId)!.fullName;
  for (const child of db.children) {
    const zw = normal() * 0.9 + (faker.datatype.boolean({ probability: 0.05 }) ? -1.8 : faker.datatype.boolean({ probability: 0.05 }) ? 2.2 : 0);
    const zh = normal() * 0.9 + (faker.datatype.boolean({ probability: 0.04 }) ? -1.6 : 0);
    for (const m of [shiftMonthStr(month, -2), shiftMonthStr(month, -1), month]) {
      const date = `${m}-${String(faker.number.int({ min: 8, max: 12 })).padStart(2, "0")}`;
      if (date > today || date < child.enrolledOn) continue;
      const months = ageInMonths(child.dob, date);
      const heightCm = +valueAt("HFA", child.gender, months, zh).toFixed(1);
      const weightKg = +valueAt("WFA", child.gender, months, zw + normal() * 0.05).toFixed(1);
      db.measurements.push({
        id: faker.string.uuid(),
        schoolId: child.schoolId,
        classId: child.classId,
        childId: child.id,
        measuredOn: date,
        weightKg,
        heightCm,
        source: "CLASS",
        recordedByName: recorder,
        ...classify(child.gender, child.dob, date, weightKg, heightCm),
      });
    }
  }

  // ---- Sổ theo dõi sức khỏe, khám định kỳ ----
  const LOGS = [
    { type: "FEVER" as const, content: "Sốt sau giờ ngủ trưa, đã chườm mát và báo phụ huynh", temperatureC: 38.3 },
    { type: "MEDICINE" as const, content: "Phụ huynh dặn uống siro ho sau bữa trưa" },
    { type: "INCIDENT" as const, content: "Ngã trầy đầu gối khi chơi ngoài sân, đã sát trùng" },
    { type: "OTHER" as const, content: "Ăn ít hơn mọi ngày, theo dõi thêm" },
  ];
  for (const school of db.schools) {
    const kids = db.children.filter((c) => c.schoolId === school.id);
    for (let i = 0; i < 8; i++) {
      const child = faker.helpers.arrayElement(kids);
      const log = faker.helpers.arrayElement(LOGS);
      const date = addDays(today, -faker.number.int({ min: 0, max: 20 }));
      db.healthLogs.push({
        id: faker.string.uuid(),
        schoolId: school.id,
        childId: child.id,
        childName: child.fullName,
        classId: child.classId,
        className: db.classes.find((c) => c.id === child.classId)?.name,
        logDate: date,
        type: log.type,
        content: log.content,
        temperatureC: log.temperatureC,
        parentNotifiedAt: log.type === "FEVER" || faker.datatype.boolean() ? at(date, 14) : undefined,
        parentNotifiedByName: recorder,
        recordedByName: recorder,
      });
    }
    for (const child of kids.slice(0, 10)) {
      db.checkups.push({ id: faker.string.uuid(), schoolId: school.id, childId: child.id, checkupDate: `${shiftMonthStr(month, -1)}-20`, provider: "Trạm y tế phường", summary: "Sức khỏe bình thường." });
    }
  }

  // ---- Tài khoản đăng nhập: mỗi nhân viên có email một tài khoản, vai trò theo chức vụ ----
  const ACCOUNT_ROLE: Partial<Record<StaffRec["position"], string>> = {
    TEACHER: "TEACHER",
    NURSE: "NURSE",
    COOK: "KITCHEN",
    ACCOUNTANT: "ACCOUNTANT",
    SECURITY: "STAFF",
  };
  for (const s of db.staff) {
    const role = ACCOUNT_ROLE[s.position];
    if (!s.email || (!role && s.position !== "MANAGER")) continue;
    db.accounts.push({ id: faker.string.uuid(), staffId: s.id, email: s.email, active: true, roles: role ? [{ role, schoolId: s.schoolId }] : [] });
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
