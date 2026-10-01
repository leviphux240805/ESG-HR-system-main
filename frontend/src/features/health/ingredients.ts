export interface IngredientInput {
  name: string;
  grams?: number;
}

const LINE = /^(.*?)[\s,;:–-]+(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)?$/i;

/** Mỗi dòng một nguyên liệu: "Thịt lợn 30", "Thịt lợn, 30g" hoặc chỉ "Hành lá". Dòng trống bị bỏ. */
export function parseIngredients(text: string): IngredientInput[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = LINE.exec(line);
      return m && m[1].trim() ? { name: m[1].trim(), grams: Number(m[2].replace(",", ".")) } : { name: line };
    });
}

export function formatIngredients(list: readonly { name: string; grams?: number | null }[]): string {
  return list.map((i) => (i.grams != null ? `${i.name} ${i.grams}` : i.name)).join("\n");
}

/** "Thịt lợn (30 g), Hành lá" */
export function ingredientSummary(list: readonly { name: string; grams?: number | null }[]): string {
  return list.map((i) => (i.grams != null ? `${i.name} (${i.grams} g)` : i.name)).join(", ");
}
