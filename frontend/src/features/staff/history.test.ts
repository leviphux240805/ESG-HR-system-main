import { describe, expect, it } from "vitest";
import type { HistoryEvent } from "./api";
import { describeEvent, staffChanges } from "./history";

const ctx = {
  schoolName: (id: string) => ({ a: "Cơ sở A", b: "Cơ sở B" })[id],
  documentTypeName: (key: string) => ({ QUYET_DINH_DIEU_CHUYEN: "Quyết định điều chuyển", t1: "Giấy khám sức khỏe" })[key],
};

const event = (entity: string, action: HistoryEvent["action"], before: object | null, after: object | null): HistoryEvent => ({
  id: "e1",
  at: "2026-09-30T02:00:00Z",
  entity,
  action,
  before: before as HistoryEvent["before"],
  after: after as HistoryEvent["after"],
});

describe("staffChanges", () => {
  it("liệt kê trường đổi kèm giá trị cũ → mới, định dạng ngày và nhãn", () => {
    expect(
      staffChanges(
        { phone: "0901", position: "TEACHER", dob: "1990-01-02", fullName: "A" },
        { phone: "0902", position: "NANNY", dob: "1990-01-03", fullName: "A" },
      ),
    ).toEqual(["Số điện thoại: 0901 → 0902", "Vị trí: Giáo viên → Bảo mẫu", "Ngày sinh: 02/01/1990 → 03/01/1990"]);
  });

  it("địa chỉ gộp một dòng 'đã thay đổi', không lộ mã", () => {
    expect(
      staffChanges(
        { permProvinceCode: "01", permWardCode: "001", email: null },
        { permProvinceCode: "79", permWardCode: "002", email: "x@y.vn" },
      ),
    ).toEqual(["Email: (trống) → x@y.vn", "Địa chỉ thường trú: đã thay đổi"]);
  });
});

describe("describeEvent", () => {
  it("điều chuyển: tên cơ sở và trạng thái chờ", () => {
    expect(
      describeEvent(
        event("staff.transfer", "UPDATE", { schoolId: "a" }, { schoolId: "b", effectiveDate: "2026-10-01", applied: false }),
        ctx,
      ),
    ).toEqual({
      title: "Điều chuyển cơ sở",
      details: ["Từ Cơ sở A sang Cơ sở B", "Hiệu lực từ 01/10/2026", "Chờ tới ngày hiệu lực"],
    });
  });

  it("giấy tờ: lấy tên loại từ DTO, mã hoặc id", () => {
    expect(describeEvent(event("staff.document", "CREATE", null, { type: { name: "CCCD – mặt trước" } }), ctx).details).toEqual([
      "CCCD – mặt trước",
    ]);
    expect(describeEvent(event("staff.document", "CREATE", null, { documentType: "QUYET_DINH_DIEU_CHUYEN" }), ctx).details).toEqual([
      "Quyết định điều chuyển",
    ]);
    expect(describeEvent(event("staff.document", "DELETE", { documentTypeId: "t1" }, null), ctx)).toEqual({
      title: "Xóa giấy tờ",
      details: ["Giấy khám sức khỏe"],
    });
  });

  it("hợp đồng không thời hạn", () => {
    expect(
      describeEvent(event("staff.contract", "CREATE", null, { contractType: "INDEFINITE", contractNo: "12/HĐ", startDate: "2026-01-01" }), ctx),
    ).toEqual({ title: "Thêm hợp đồng", details: ["Không xác định thời hạn, số 12/HĐ", "01/01/2026 – không thời hạn"] });
  });

  it("nghỉ việc", () => {
    expect(
      describeEvent(event("staff.terminate", "UPDATE", { status: "ACTIVE" }, { status: "TERMINATED", endDate: "2026-09-30", reason: "Chuyển nơi ở" }), ctx),
    ).toEqual({ title: "Cho nghỉ việc", details: ["Ngày nghỉ: 30/09/2026", "Lý do: Chuyển nơi ở"] });
  });
});
