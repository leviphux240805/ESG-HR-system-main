/**
 * Vietnamese common holidays for dropdown selection
 */

export interface CommonHoliday {
  id: string;
  name: string;
  description?: string;
}

// List of common Vietnamese holidays for dropdown
export const commonHolidays: CommonHoliday[] = [
  { id: "tet_duong_lich", name: "Tết Dương lịch", description: "Ngày 1/1 hàng năm" },
  { id: "tet_nguyen_dan", name: "Tết Nguyên Đán", description: "Theo lịch âm" },
  { id: "gio_to_hung_vuong", name: "Giỗ Tổ Hùng Vương", description: "10/3 âm lịch" },
  { id: "giai_phong", name: "Ngày Giải phóng miền Nam", description: "30/4" },
  { id: "quoc_te_lao_dong", name: "Ngày Quốc tế Lao động", description: "1/5" },
  { id: "quoc_khanh", name: "Quốc khánh", description: "2/9" },
  { id: "nghi_bu", name: "Nghỉ bù", description: "Ngày nghỉ bù cho ngày lễ" },
  { id: "custom", name: "Khác (tự nhập)", description: "Ngày nghỉ tùy chỉnh" },
];

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  is_custom: boolean;
  description?: string;
}
