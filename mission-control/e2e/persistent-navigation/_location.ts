import { expect, type Page } from "@playwright/test";
export type LocationCase = {
  family: string;
  href: string;
  selected: string;
  next: string;
  nextPath: string;
  content: string;
};
export async function assertLocation(page: Page, target: LocationCase): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${target.href.replaceAll("/", "\\/")}$`));
  await expect(page.getByTestId(target.selected)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId(target.content)).toBeVisible();
}
