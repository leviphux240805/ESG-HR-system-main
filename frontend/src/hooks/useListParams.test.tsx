import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useListParams } from "./useListParams";
import { useDebouncedValue } from "./useDebouncedValue";

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(
    () => ({ params: useListParams({ filterKeys: ["status"] }), location: useLocation() }),
    { wrapper },
  ).result;
}

describe("useListParams", () => {
  it("đọc trạng thái từ URL và đổi sang quy ước API (page từ 0)", () => {
    const result = setup("/nhan-su?page=3&size=50&sort=fullName,desc&q=lan&status=ACTIVE&other=x");
    const { params } = result.current;

    expect(params.page).toBe(3);
    expect(params.size).toBe(50);
    expect(params.sort).toEqual({ field: "fullName", direction: "desc" });
    expect(params.filters).toEqual({ status: "ACTIVE" });
    expect(params.apiParams).toEqual({ page: 2, size: 50, sort: "fullName,desc", q: "lan", status: "ACTIVE" });
    expect(params.hasActiveFilters).toBe(true);
  });

  it("giá trị mặc định và size không hợp lệ", () => {
    const { params } = setup("/nhan-su?size=9999&page=-2").current;
    expect(params.page).toBe(1);
    expect(params.size).toBe(20);
    expect(params.apiParams).toEqual({ page: 0, size: 20 });
  });

  it("đổi bộ lọc hoặc tìm kiếm thì về trang 1; đổi trang thì giữ bộ lọc", () => {
    const result = setup("/nhan-su?page=4&status=ACTIVE");

    act(() => result.current.params.setPage(5));
    expect(result.current.location.search).toBe("?page=5&status=ACTIVE");

    act(() => result.current.params.setFilter("status", "INACTIVE"));
    expect(result.current.location.search).toBe("?status=INACTIVE");

    act(() => result.current.params.setSearch("  Lan  "));
    expect(result.current.params.q).toBe("Lan");

    act(() => result.current.params.clearFilters());
    expect(result.current.location.search).toBe("");
  });
});

describe("useDebouncedValue", () => {
  it("chỉ cập nhật sau 300 ms ngừng thay đổi", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");
    vi.useRealTimers();
  });
});
