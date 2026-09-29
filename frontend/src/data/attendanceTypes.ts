// ============================================
// ATTENDANCE TYPES - Vietnamese Labeling System
// ============================================

// Attendance label codes based on Vietnamese HR standards
export type AttendanceLabel =
  | 'X'         // Đủ công (full day work)
  | 'O'         // Ốm, điều dưỡng (sick leave)
  | 'CO'        // Con ốm (child sick)
  | 'TS'        // Thai sản (maternity)
  | 'T'         // Tai nạn (accident)
  | 'NL'        // Ngày lễ (holiday)
  | 'NB'        // Nghỉ bù (compensatory leave)
  | '1/2K'      // Nghỉ nửa ngày không lương (half-day unpaid)
  | 'K'         // Nghỉ không lương (unpaid leave)
  | 'P'         // Nghỉ phép (paid leave)
  | '1/2P'      // Nghỉ nửa ngày tính phép (half-day paid)
  | 'NN'        // Làm nửa ngày công (half-day work)
  | 'CN'        // Chủ nhật (Sunday - no label, just highlight)
  | 'T7'        // Thứ 7 (Saturday - no label, just highlight)
  | 'NOTE'      // Special note/reason (highlight)
  | ''          // Future/empty

// Label descriptions in Vietnamese
export const labelDescriptions: Record<AttendanceLabel, string> = {
  'X': 'Đủ công',
  'O': 'Ốm, điều dưỡng',
  'CO': 'Con ốm',
  'TS': 'Thai sản',
  'T': 'Tai nạn',
  'NL': 'Ngày lễ',
  'NB': 'Nghỉ bù',
  '1/2K': 'Nghỉ nửa ngày không lương',
  'K': 'Nghỉ không lương',
  'P': 'Nghỉ phép',
  '1/2P': 'Nghỉ nửa ngày tính phép',
  'NN': 'Làm nửa ngày công',
  'CN': 'Chủ nhật',
  'T7': 'Thứ bảy',
  'NOTE': 'Lý do đặc biệt',
  '': 'Chưa chấm công',
};

// Status options for the input dialog (excluding weekends and empty)
export const attendanceOptions: { value: AttendanceLabel; label: string }[] = [
  { value: 'X', label: 'Đủ công' },
  { value: 'O', label: 'Ốm, điều dưỡng' },
  { value: 'CO', label: 'Con ốm' },
  { value: 'TS', label: 'Thai sản' },
  { value: 'T', label: 'Tai nạn' },
  { value: 'NL', label: 'Ngày lễ' },
  { value: 'NB', label: 'Nghỉ bù' },
  { value: '1/2K', label: 'Nghỉ nửa ngày không lương' },
  { value: 'K', label: 'Nghỉ không lương' },
  { value: 'P', label: 'Nghỉ phép' },
  { value: '1/2P', label: 'Nghỉ nửa ngày tính phép' },
  { value: 'NN', label: 'Làm nửa ngày công' },
];

// Minimal color configuration
// Only weekends and special items get colors; most use neutral styling
export const labelColors: Record<AttendanceLabel, { bg: string; text: string }> = {
  'X': { bg: 'bg-white', text: 'text-foreground' },
  'O': { bg: 'bg-white', text: 'text-foreground' },
  'CO': { bg: 'bg-white', text: 'text-foreground' },
  'TS': { bg: 'bg-white', text: 'text-foreground' },
  'T': { bg: 'bg-white', text: 'text-foreground' },
  'NL': { bg: 'bg-red-50', text: 'text-red-600' },        // Holiday: same as Sunday
  'NB': { bg: 'bg-white', text: 'text-foreground' },
  '1/2K': { bg: 'bg-white', text: 'text-foreground' },
  'K': { bg: 'bg-white', text: 'text-foreground' },
  'P': { bg: 'bg-white', text: 'text-foreground' },
  '1/2P': { bg: 'bg-white', text: 'text-foreground' },
  'NN': { bg: 'bg-white', text: 'text-foreground' },
  'CN': { bg: 'bg-red-50', text: 'text-red-600' },        // Sunday: light pink
  'T7': { bg: 'bg-slate-100', text: 'text-slate-600' },   // Saturday: light gray
  'NOTE': { bg: 'bg-amber-50', text: 'text-amber-700' },  // Special note: light amber
  '': { bg: 'bg-white', text: 'text-muted-foreground' },
};

// Vietnamese month names
export const vietnameseMonths = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// Vietnamese day names (short)
export const vietnameseDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Attendance record interface
export interface AttendanceRecord {
  date: Date;
  label: AttendanceLabel;
  note?: string;           // Optional reason/note
  clockIn?: string;        // e.g., "08:00"
  clockOut?: string;       // e.g., "17:30"
}

// Generate year options
export const currentYear = new Date().getFullYear();
export const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
