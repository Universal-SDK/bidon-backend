import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Click-through of the admin console for BAC-128.
 * Requires `just compose` (UI on :3010, admin on :1323) and the dev superuser.
 *
 * The recording is Playwright's video of this browser, written under test-results/.
 */

const EMAIL = process.env.ADMIN_EMAIL ?? "login@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "password";

test("admin creates an app, an auction, and bidding and waterfall line items", async ({
  page,
}) => {
  const stamp = Date.now().toString().slice(-6);
  const appName = `Demo App ${stamp}`;
  const renamed = `${appName} Edited`;
  const packageName = `com.bidon.demo${stamp}`;
  const auctionName = `Demo Banner ${stamp}`;
  const auctionRenamed = `${auctionName} Edited`;
  const biddingLabel = `BidMachine banner ${stamp}`;
  const waterfallLabel = `AppLovin banner ${stamp}`;

  const mark = (step: string) => console.log(`step: ${step}`);

  mark("login");
  await page.goto("/login");
  await page.locator("#emailInput").fill(EMAIL);
  await page.locator("#passwordInput").fill(PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL(/\/apps/);
  // Client navigation from the login layout can mount the auth store before
  // PrimeVue's toast service exists, which renders a 500. A full load uses
  // the session cookie and lands on the apps grid.
  await expect(async () => {
    if (!(await page.getByRole("link", { name: "New App" }).isVisible())) {
      await page.goto("/apps");
    }
    await expect(page.getByRole("link", { name: "New App" })).toBeVisible({
      timeout: 4_000,
    });
  }).toPass({ timeout: 30_000 });
  await beat(page);

  mark("theme");
  await page.getByTitle("Switch to dark mode").click();
  await beat(page);
  await page.getByTitle("Switch to light mode").click();
  await beat(page);

  mark("create app");
  await page.getByRole("link", { name: "New App" }).click();
  await expect(page.getByText("App Name", { exact: true })).toBeVisible();
  await fillLabeled(page, "App Name", appName);
  await chooseDropdown(row(page, "Owner"), EMAIL);
  await chooseDropdown(row(page, "Platform"), "android");
  await fillLabeled(page, "Package Name", packageName);
  await beat(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(appName, { exact: true }).first()).toBeVisible();
  await beat(page);

  mark("edit app");
  await page.getByRole("link", { name: "Edit" }).click();
  await fillLabeled(page, "App Name", renamed);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("App updated!")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();
  await beat(page);

  mark("profiles");
  await createProfile(page, "BidMachine");
  await createProfile(page, "AppLovin");

  mark("auction");
  await page.locator("button:visible", { hasText: "New Auction Config" }).click();
  const auctionForm = page.locator(".inline-auction-config-form");
  await expect(auctionForm).toBeVisible();
  await fillLabeled(auctionForm, "Name", auctionName);
  await chooseDropdown(row(auctionForm, "Ad Type"), "banner");
  await fillLabeled(auctionForm, "Price floor", "1.50");
  await beat(page);

  const bidding = networkCard(auctionForm, "Bidding Networks", "BidMachine");
  await bidding.getByRole("button", { name: "Disabled" }).click();
  await expect(bidding.getByRole("button", { name: "Enabled" })).toBeVisible();
  await bidding.getByRole("button", { name: "New line item" }).click();
  await fillLabeled(bidding, "Label", biddingLabel);
  await bidding.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Line item created.").last()).toBeVisible();
  await expect(bidding.getByText(biddingLabel, { exact: true })).toBeVisible();
  await beat(page);

  const waterfall = networkCard(auctionForm, "Waterfall Networks", "AppLovin");
  await waterfall.getByRole("button", { name: "Disabled" }).click();
  await expect(waterfall.getByRole("button", { name: "Enabled" })).toBeVisible();
  await waterfall.getByRole("button", { name: "New line item" }).click();
  await fillLabeled(waterfall, "Label", waterfallLabel);
  await fillLabeled(waterfall, "Zone Id", `zone-${stamp}`);
  await fillLabeled(waterfall, "Bid Floor", "0.80");
  await waterfall.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Line item created.").last()).toBeVisible();
  await expect(waterfall.getByText(waterfallLabel, { exact: true })).toBeVisible();
  await beat(page);
  await beat(page);

  await auctionForm.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Auction configuration created!")).toBeVisible();
  const auctionCard = namedCard(page, auctionName);
  await expect(auctionCard).toBeVisible();
  await beat(page);

  mark("edit auction");
  await auctionCard.getByRole("button", { name: "Edit", exact: true }).click();
  const editForm = page.locator(".inline-auction-config-form");
  await fillLabeled(editForm, "Name", auctionRenamed);
  await editForm.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Auction configuration updated!")).toBeVisible();
  const renamedCard = namedCard(page, auctionRenamed);
  await expect(renamedCard).toBeVisible();
  await beat(page);

  mark("edit line item");
  const waterfallLine = lineRow(renamedCard, waterfallLabel);
  await waterfallLine.getByRole("button", { name: "Edit line item" }).click();
  const editedWaterfall = `${waterfallLabel} v2`;
  await fillLabeled(renamedCard, "Label", editedWaterfall);
  await renamedCard.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Line item updated.")).toBeVisible();
  await expect(lineRow(renamedCard, editedWaterfall)).toBeVisible();
  await beat(page);

  mark("delete");
  await lineRow(renamedCard, editedWaterfall)
    .getByRole("button", { name: "Delete line item" })
    .click();
  await confirm(page);
  await expect(page.getByText("Line item deleted.").last()).toBeVisible();
  await expect(renamedCard.getByText(editedWaterfall, { exact: true })).toHaveCount(0);
  await beat(page);

  await lineRow(renamedCard, biddingLabel)
    .getByRole("button", { name: "Delete line item" })
    .click();
  await confirm(page);
  await expect(page.getByText("Line item deleted.").last()).toBeVisible();
  await beat(page);

  await renamedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await confirm(page);
  await expect(page.getByText("Auction configuration deleted.")).toBeVisible();
  await expect(page.getByText(auctionRenamed, { exact: true })).toHaveCount(0);
  await beat(page);

  await deleteProfile(page, "AppLovin");
  await deleteProfile(page, "BidMachine");

  await page
    .locator(".card")
    .filter({ hasText: renamed })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await confirm(page);
  await expect(page).toHaveURL(/\/apps\/?$/);
  await expect(page.getByRole("link", { name: "New App" })).toBeVisible();
});

async function beat(page: Page) {
  await page.waitForTimeout(2_200);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The label span and its control sit in one flex row. Walking up from the
// span stays correct when the scope is a locator; filtering flex divs with
// `has` does not, and misses the dropdown.
function row(scope: Page | Locator, label: string) {
  return scope
    .locator("span", { hasText: new RegExp(`^${escapeRegex(label)}$`) })
    .locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' flex ')][1]",
    )
    .last();
}

function namedCard(page: Page, name: string) {
  return page
    .locator("span.font-semibold", {
      hasText: new RegExp(`^${escapeRegex(name)}$`),
    })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
}

function lineRow(card: Locator, label: string) {
  return card
    .locator("span", { hasText: new RegExp(`^${escapeRegex(label)}$`) })
    .locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' flex ')][1]",
    );
}

async function fillLabeled(scope: Page | Locator, label: string, value: string) {
  const input = row(scope, label).locator("input, textarea").last();
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 45 });
}

async function chooseDropdown(field: Locator, option: string) {
  const page = field.page();
  await field.locator(".p-dropdown").click();
  const panel = field.page().locator(".p-dropdown-panel").last();
  await expect(panel).toBeVisible();
  await page.waitForTimeout(900);
  const filter = panel.locator("input");
  if (await filter.count()) {
    await filter.fill(option);
  }
  await panel.getByRole("option", { name: option, exact: true }).click();
}

function networkCard(form: Locator, section: string, network: string) {
  const list = form
    .locator("p")
    .filter({ hasText: new RegExp(`^${section}$`) })
    .locator("xpath=following-sibling::div[1]");
  return list.locator("details").filter({ hasText: network }).first();
}

async function createProfile(page: Page, network: string) {
  const section = page.locator("div.mt-10").filter({
    has: page.getByRole("heading", { name: "Demand Source Profiles" }),
  });
  await section.getByRole("button", { name: "Create Profile" }).click();
  // The heading gains the network name once one is chosen, so keep the form
  // anchored to the section instead of that text.
  const form = section.locator("div.rounded-lg").first();
  await chooseDropdown(row(form, "Network"), network);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Demand source profile created.").last()).toBeVisible();
  await expect(namedCard(page, network)).toBeVisible();
  await beat(page);
}

async function deleteProfile(page: Page, network: string) {
  await namedCard(page, network)
    .getByRole("button", { name: "Delete profile" })
    .click();
  await confirm(page);
  await expect(page.getByText("Demand source profile deleted.").last()).toBeVisible();
  await beat(page);
}

async function confirm(page: Page) {
  const dialog = page.locator(".p-confirm-dialog");
  await expect(dialog).toBeVisible();
  await beat(page);
  await dialog.getByRole("button", { name: "Yes" }).click();
}
