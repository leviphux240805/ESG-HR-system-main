import { describe, expect, it } from "vitest";
import { parseCccdQr, titleCaseVi } from "./cccd";

describe("parseCccdQr", () => {
  it("đọc đủ các trường của QR CCCD gắn chip", () => {
    const info = parseCccdQr(
      "001198000123|123456789|NGUYỄN THỊ LAN|09091998|Nữ|Số 14 phố Mẫu, Phường Ba Đình, Quận Ba Đình, Hà Nội|15082021",
    );
    expect(info).toEqual({
      citizenId: "001198000123",
      oldId: "123456789",
      fullName: "Nguyễn Thị Lan",
      dob: "1998-09-09",
      gender: "FEMALE",
      address: "Số 14 phố Mẫu, Phường Ba Đình, Quận Ba Đình, Hà Nội",
      issuedOn: "2021-08-15",
    });
  });

  it("thiếu CMND cũ, giới tính Nam", () => {
    const info = parseCccdQr("079090000555||TRẦN VĂN ĐỨC|31121990|Nam|Phường Bến Thành, TP. Hồ Chí Minh|01072024");
    expect(info?.oldId).toBeUndefined();
    expect(info?.gender).toBe("MALE");
    expect(info?.fullName).toBe("Trần Văn Đức");
    expect(info?.dob).toBe("1990-12-31");
  });

  it("ngày sai định dạng thì bỏ trống, không đoán", () => {
    expect(parseCccdQr("001198000123||LÊ AN|31021998|Nam||99999999")?.dob).toBeUndefined();
  });

  it("không phải QR CCCD thì trả null", () => {
    expect(parseCccdQr("https://example.com")).toBeNull();
    expect(parseCccdQr("12345|abc|TÊN")).toBeNull();
    expect(parseCccdQr("001198000123||")).toBeNull();
  });
});

describe("titleCaseVi", () => {
  it("viết hoa chữ cái đầu mỗi từ, giữ dấu tiếng Việt", () => {
    expect(titleCaseVi("  ĐẶNG   VĂN   ÂN ")).toBe("Đặng Văn Ân");
  });
});
