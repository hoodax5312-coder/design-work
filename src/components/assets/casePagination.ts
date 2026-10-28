export const CASE_PAGE_SIZE = 50;

export const paginateCases = <T,>(items: T[], requestedPage: number) => {
  const pageCount = Math.max(1, Math.ceil(items.length / CASE_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * CASE_PAGE_SIZE;
  return { items: items.slice(start, start + CASE_PAGE_SIZE), page, pageCount, start };
};
