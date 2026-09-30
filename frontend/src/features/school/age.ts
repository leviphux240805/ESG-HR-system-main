/** Tuổi của trẻ tại ngày `at`: dưới 3 tuổi tính theo tháng ("30 tháng"), từ 3 tuổi "4 tuổi 2 tháng". */
export function formatAge(dob: string, at = new Date()): string {
  const [y, m, d] = dob.split("-").map(Number);
  let months = (at.getFullYear() - y) * 12 + (at.getMonth() + 1 - m);
  if (at.getDate() < d) months -= 1;
  if (months < 0) return "";
  if (months < 36) return `${months} tháng`;
  const rest = months % 12;
  return rest ? `${Math.floor(months / 12)} tuổi ${rest} tháng` : `${months / 12} tuổi`;
}
