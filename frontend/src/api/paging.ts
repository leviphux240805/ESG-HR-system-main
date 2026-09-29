/** Khớp PageResponse của backend (com.preschool.common.web.PageResponse). */
export interface Paged<T> {
  items: T[];
  /** Số trang, bắt đầu từ 0. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
