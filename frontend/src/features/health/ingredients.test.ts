import { describe, expect, it } from "vitest";
import { formatIngredients, ingredientSummary, parseIngredients } from "./ingredients";

describe("ingredients", () => {
  it("đọc tên và số gram theo nhiều cách viết", () => {
    expect(parseIngredients("Thịt lợn 30\nTôm, 25g\n  \nHành lá\nSữa bò: 100 gram\nDầu ăn - 2,5")).toEqual([
      { name: "Thịt lợn", grams: 30 },
      { name: "Tôm", grams: 25 },
      { name: "Hành lá" },
      { name: "Sữa bò", grams: 100 },
      { name: "Dầu ăn", grams: 2.5 },
    ]);
  });

  it("dòng chỉ có số giữ nguyên làm tên", () => {
    expect(parseIngredients("123")).toEqual([{ name: "123" }]);
  });

  it("định dạng ngược lại để sửa và để hiển thị", () => {
    const list = [{ name: "Tôm", grams: 25 }, { name: "Hành lá", grams: null }];
    expect(formatIngredients(list)).toBe("Tôm 25\nHành lá");
    expect(parseIngredients(formatIngredients(list))).toEqual([{ name: "Tôm", grams: 25 }, { name: "Hành lá" }]);
    expect(ingredientSummary(list)).toBe("Tôm (25 g), Hành lá");
  });
});
