export interface Ward {
  ward_code: string;
  name: string;
  province_code: string;
}

export interface District {
  district_code: string;
  name: string;
  province_code: string;
  wards?: Ward[];
}

export interface Province {
  province_code: string;
  name: string;
  short_name: string;
  code: string;
  place_type: string;
  wards: Ward[];
}

let addressDataCache: Province[] | null = null;

/**
 * Load address data từ file addressData.json
 */
export const loadAddressData = async (): Promise<Province[]> => {
  if (addressDataCache) {
    return addressDataCache;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}addressData.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch address data: ${response.status}`);
    }
    addressDataCache = await response.json();
    return addressDataCache;
  } catch (error) {
    console.error("Failed to load address data:", error);
    return [];
  }
};

/**
 * Lấy danh sách tỉnh/thành phố
 */
export const getProvinces = (
  data: Province[]
): Array<{ code: string; name: string }> => {
  return data.map((province) => ({
    code: province.province_code,
    name: province.name,
  }));
};

/**
 * Lấy danh sách quận/huyện dựa vào mã tỉnh
 */
export const getDistrictsByProvinceCode = (
  data: Province[],
  provinceCode: string
): Array<{ code: string; name: string }> => {
  const province = data.find((p) => p.province_code === provinceCode);
  if (!province) return [];

  // Trong file addressData.json, wards chính là districts
  return province.wards.map((ward) => ({
    code: ward.ward_code,
    name: ward.name,
  }));
};

/**
 * Alias cho getDistrictsByProvinceCode - dùng cho compatibility
 */
export const getDistricts = getDistrictsByProvinceCode;

/**
 * Lấy tỉnh/thành phố theo tên
 */
export const getProvinceByName = (
  data: Province[],
  name: string
): Province | undefined => {
  return data.find(
    (p) =>
      p.name.toLowerCase() === name.toLowerCase() ||
      p.short_name.toLowerCase() === name.toLowerCase()
  );
};

/**
 * Lấy tỉnh/thành phố theo mã
 */
export const getProvinceByCode = (
  data: Province[],
  code: string
): Province | undefined => {
  return data.find((p) => p.province_code === code);
};

/**
 * Lấy tên tỉnh từ mã
 */
export const getProvinceName = (
  data: Province[],
  provinceCode: string
): string => {
  const province = getProvinceByCode(data, provinceCode);
  return province?.name || "";
};

/**
 * Lấy tên quận/huyện từ mã
 */
export const getDistrictName = (
  data: Province[],
  provinceCode: string,
  wardCode: string
): string => {
  const province = getProvinceByCode(data, provinceCode);
  if (!province) return "";

  const ward = province.wards.find((w) => w.ward_code === wardCode);
  return ward?.name || "";
};

/**
 * Validate địa chỉ (kiểm tra xem tỉnh/quận/huyện có tồn tại không)
 */
export const isValidAddress = (
  data: Province[],
  provinceCode: string,
  wardCode: string
): boolean => {
  const province = getProvinceByCode(data, provinceCode);
  if (!province) return false;

  const ward = province.wards.find((w) => w.ward_code === wardCode);
  return !!ward;
};
