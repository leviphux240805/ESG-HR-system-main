// ============================================
// ATTENDANCE MOCK DATA - Vietnamese Locale
// ============================================

// Attendance status types
export type AttendanceStatus = 
  | 'full_day'      // Full day on time (green)
  | 'late'          // Full day but late (yellow)
  | 'half_day'      // Half day attendance (orange)
  | 'absent'        // Absent without excuse (gray)
  | 'day_off_paid'  // Paid leave (red with P badge)
  | 'day_off_unpaid'// Unpaid leave (red)
  | 'holiday'       // Public holiday (red)
  | 'sick_leave'    // Sick leave (red with S badge)
  | 'weekend'       // Weekend day
  | 'future';       // Future/unassigned day

export interface AttendanceRecord {
  date: Date;
  status: AttendanceStatus;
  clockIn?: string;      // e.g., "08:00"
  clockOut?: string;     // e.g., "17:30"
  lateMinutes?: number;  // Minutes late if applicable
  note?: string;         // Optional note
}

export interface AttendanceEmployee {
  id: number;
  employeeID: string;
  name: string;
  department: string;
  position: string;
  avatar?: string;
}

export interface AttendanceStats {
  lateDays: number;
  totalWorkDays: number;
  fullDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  sickDays: number;
  holidayDays: number;
  weekendDays: number;
  totalPresent: number;
  totalAbsent: number;
}

// Mock employee list for attendance selection
export const attendanceEmployees: AttendanceEmployee[] = [
  { id: 1, employeeID: "NV001", name: "Nguyễn Văn An", department: "Kỹ thuật", position: "Lập trình viên Senior" },
  { id: 2, employeeID: "NV002", name: "Trần Thị Bình", department: "Nhân sự", position: "Trưởng phòng HR" },
  { id: 3, employeeID: "NV003", name: "Lê Văn Cường", department: "Marketing", position: "Chuyên viên Marketing" },
  { id: 4, employeeID: "NV004", name: "Phạm Thị Dung", department: "Kế toán", position: "Kế toán trưởng" },
  { id: 5, employeeID: "NV005", name: "Hoàng Văn Em", department: "Kỹ thuật", position: "Team Lead" },
  { id: 6, employeeID: "NV006", name: "Vũ Thị Phương", department: "Kinh doanh", position: "Nhân viên kinh doanh" },
  { id: 7, employeeID: "NV007", name: "Đặng Văn Giang", department: "Hành chính", position: "Trợ lý giám đốc" },
  { id: 8, employeeID: "NV008", name: "Bùi Thị Hoa", department: "Kỹ thuật", position: "QA Engineer" },
];

// Generate mock attendance data for a year
export const generateMockAttendanceData = (year: number): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const isPast = date < today;
      const isToday = date.toDateString() === today.toDateString();
      
      // Weekend
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        records.push({
          date,
          status: 'weekend',
        });
        continue;
      }
      
      // Future dates
      if (!isPast && !isToday) {
        records.push({
          date,
          status: 'future',
        });
        continue;
      }
      
      // Random status for past dates
      const random = Math.random();
      
      if (random < 0.65) {
        // 65% - Full day on time
        records.push({
          date,
          status: 'full_day',
          clockIn: '08:00',
          clockOut: '17:30',
        });
      } else if (random < 0.80) {
        // 15% - Late arrival
        const lateMinutes = Math.floor(Math.random() * 45) + 5; // 5-50 minutes late
        records.push({
          date,
          status: 'late',
          clockIn: `08:${lateMinutes.toString().padStart(2, '0')}`,
          clockOut: '17:30',
          lateMinutes,
        });
      } else if (random < 0.85) {
        // 5% - Half day
        records.push({
          date,
          status: 'half_day',
          clockIn: '08:00',
          clockOut: '12:00',
          note: 'Chỉ làm buổi sáng',
        });
      } else if (random < 0.90) {
        // 5% - Paid leave
        records.push({
          date,
          status: 'day_off_paid',
          note: 'Nghỉ phép năm',
        });
      } else if (random < 0.93) {
        // 3% - Sick leave
        records.push({
          date,
          status: 'sick_leave',
          note: 'Nghỉ ốm có giấy bác sĩ',
        });
      } else if (random < 0.96) {
        // 3% - Unpaid leave
        records.push({
          date,
          status: 'day_off_unpaid',
          note: 'Nghỉ không lương',
        });
      } else if (random < 0.98) {
        // 2% - Holiday
        records.push({
          date,
          status: 'holiday',
          note: 'Ngày lễ',
        });
      } else {
        // 2% - Absent
        records.push({
          date,
          status: 'absent',
          note: 'Vắng không phép',
        });
      }
    }
  }
  
  return records;
};

// Calculate statistics from attendance records
export const calculateAttendanceStats = (records: AttendanceRecord[]): AttendanceStats => {
  const stats: AttendanceStats = {
    lateDays: 0,
    totalWorkDays: 0,
    fullDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    sickDays: 0,
    holidayDays: 0,
    weekendDays: 0,
    totalPresent: 0,
    totalAbsent: 0,
  };

  records.forEach((record) => {
    switch (record.status) {
      case 'full_day':
        stats.fullDays++;
        stats.totalPresent++;
        stats.totalWorkDays++;
        break;
      case 'late':
        stats.lateDays++;
        stats.fullDays++;
        stats.totalPresent++;
        stats.totalWorkDays++;
        break;
      case 'half_day':
        stats.halfDays++;
        stats.totalPresent += 0.5;
        stats.totalWorkDays++;
        break;
      case 'day_off_paid':
        stats.paidLeaveDays++;
        stats.totalWorkDays++;
        break;
      case 'day_off_unpaid':
        stats.unpaidLeaveDays++;
        stats.totalAbsent++;
        stats.totalWorkDays++;
        break;
      case 'sick_leave':
        stats.sickDays++;
        stats.totalWorkDays++;
        break;
      case 'holiday':
        stats.holidayDays++;
        break;
      case 'weekend':
        stats.weekendDays++;
        break;
      case 'absent':
        stats.totalAbsent++;
        stats.totalWorkDays++;
        break;
    }
  });

  return stats;
};

// Vietnamese month names
export const vietnameseMonths = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

// Vietnamese day names (short)
export const vietnameseDays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Status labels in Vietnamese
export const statusLabels: Record<AttendanceStatus, string> = {
  full_day: 'Đủ công',
  late: 'Đi muộn',
  half_day: 'Nửa ngày',
  absent: 'Vắng mặt',
  day_off_paid: 'Nghỉ phép',
  day_off_unpaid: 'Nghỉ không lương',
  holiday: 'Ngày lễ',
  sick_leave: 'Nghỉ ốm',
  weekend: 'Cuối tuần',
  future: 'Chưa đến',
};

// Status colors for styling
export const statusColors: Record<AttendanceStatus, { bg: string; text: string; border?: string }> = {
  full_day: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  late: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  half_day: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  absent: { bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-400' },
  day_off_paid: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  day_off_unpaid: { bg: 'bg-red-200', text: 'text-red-800', border: 'border-red-400' },
  holiday: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  sick_leave: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  weekend: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  future: { bg: 'bg-white', text: 'text-gray-400', border: 'border-gray-200' },
};
