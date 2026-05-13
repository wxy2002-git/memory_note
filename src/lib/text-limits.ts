export const MAX_TITLE_LENGTH = 300;
export const MAX_SEARCH_LENGTH = 80;

export function normalizeTitleInput(title: string, label = "标题") {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error(`${label}不能为空。`);
  }

  if (normalizedTitle.length > MAX_TITLE_LENGTH) {
    throw new Error(`${label}最多 ${MAX_TITLE_LENGTH} 个字符，请缩短后再保存。`);
  }

  return normalizedTitle;
}

export function toLimitedSearchTerm(search: string) {
  return search.trim().slice(0, MAX_SEARCH_LENGTH);
}

export function canSearchSimilarTitle(input: string) {
  const normalizedInput = input.trim();

  return normalizedInput.length > 0 && normalizedInput.length <= MAX_TITLE_LENGTH;
}
