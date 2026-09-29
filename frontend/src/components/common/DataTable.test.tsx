import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";
import { useListParams } from "@/hooks/useListParams";
import type { Paged } from "@/api/paging";

const auth = vi.hoisted(() => ({ me: { roles: [{ role: "TEACHER" }] }, selectedSchoolId: null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

interface Row {
  id: string;
  name: string;
  salary: number;
}

const columns: ColumnDef<Row>[] = [
  { id: "name", accessorKey: "name", header: "Họ tên", enableSorting: true },
  // Giáo viên không xem được lương → cột bị ẩn
  { id: "salary", accessorKey: "salary", header: "Lương", meta: { permission: { action: "view", resource: "payroll" } } },
];

const page = (items: Row[], totalElements = items.length, pageIndex = 0): Paged<Row> => ({
  items,
  page: pageIndex,
  size: 20,
  totalElements,
  totalPages: Math.ceil(totalElements / 20),
});

function Harness({ data, isLoading = false }: { data?: Paged<Row>; isLoading?: boolean }) {
  const params = useListParams();
  const location = useLocation();
  return (
    <>
      <DataTable
        tableId="test"
        columns={columns}
        params={params}
        getRowId={(r) => r.id}
        query={{ data, isLoading, isError: false, error: null, refetch: vi.fn() }}
        emptyTitle="Chưa có nhân viên"
      />
      <output data-testid="url">{location.search}</output>
    </>
  );
}

const renderTable = (props: { data?: Paged<Row>; isLoading?: boolean }) =>
  render(
    <MemoryRouter initialEntries={["/nhan-su"]}>
      <Harness {...props} />
    </MemoryRouter>,
  );

describe("DataTable", () => {
  it("hiện dữ liệu, ẩn cột không có quyền, sắp xếp và chuyển trang ghi lên URL", async () => {
    const user = userEvent.setup();
    renderTable({ data: page([{ id: "1", name: "Nguyễn Văn An", salary: 9000000 }], 45) });

    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(screen.queryByText("Lương")).not.toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1–20 / 45")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Họ tên/ }));
    expect(screen.getByTestId("url")).toHaveTextContent("sort=name%2Casc");

    await user.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(screen.getByTestId("url")).toHaveTextContent("page=2");
  });

  it("rỗng thì hiện EmptyState, đang tải thì hiện skeleton", () => {
    const { unmount } = renderTable({ data: page([]) });
    expect(screen.getByText("Chưa có nhân viên")).toBeInTheDocument();
    unmount();

    renderTable({ isLoading: true });
    expect(within(document.body).getByLabelText("Đang tải")).toBeInTheDocument();
  });
});
