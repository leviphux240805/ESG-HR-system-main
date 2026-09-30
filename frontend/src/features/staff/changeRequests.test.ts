import { describe, expect, it } from "vitest";
import type { Province } from "@/data/addressDataLoader";
import { describeChanges } from "./changeRequests";

const provinces: Province[] = [
  {
    province_code: "01",
    name: "Thành phố Hà Nội",
    short_name: "Hà Nội",
    code: "HN",
    place_type: "Thành phố",
    wards: [{ ward_code: "00004", name: "Phường Ba Đình", province_code: "01" }],
  },
];

describe("describeChanges", () => {
  it("đổi mã tỉnh/phường thành tên, giá trị rỗng hiện (trống)", () => {
    expect(
      describeChanges(
        [
          { field: "phone", from: "0901000001", to: "0901000002" },
          { field: "permProvinceCode", from: undefined, to: "01" },
          { field: "permWardCode", from: "99999", to: "00004" },
          { field: "bankAccountNo", from: "123", to: undefined },
        ],
        provinces,
      ),
    ).toEqual([
      "Số điện thoại: 0901000001 → 0901000002",
      "Tỉnh/thành (thường trú): (trống) → Thành phố Hà Nội",
      "Phường/xã (thường trú): 99999 → Phường Ba Đình",
      "Số tài khoản: 123 → (trống)",
    ]);
  });
});
