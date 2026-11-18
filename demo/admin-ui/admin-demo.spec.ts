import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Click-through of the admin console for BAC-128.
 * Requires `just compose` (UI on :3010, admin on :1323) and the dev superuser.
 *
 * The recording is Playwright's video of this browser, written under test-results/.
 */

const EMAIL = process.env.ADMIN_EMAIL ?? "login@example.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "password";

test("admin creates an app, auctions, and bidding and waterfall line items", async ({
  page,
}) => {
  const stamp = Date.now().toString().slice(-6);
  const appName = `Demo App ${stamp}`;
  const renamed = `${appName} Edited`;
  const packageName = `com.bidon.demo${stamp}`;
  const bannerName = `Demo Banner ${stamp}`;
  const bannerRenamed = `${bannerName} Edited`;
  const interstitialName = `Demo Interstitial ${stamp}`;
  const rewardedName = `Demo Rewarded ${stamp}`;

  const mark = (step: string) => console.log(`step: ${step}`);

  mark("login");
  await page.goto("/login");
  await click(page.locator("#emailInput"));
  await page.locator("#emailInput").fill(EMAIL);
  await click(page.locator("#passwordInput"));
  await page.locator("#passwordInput").fill(PASSWORD);
  await click(page.getByRole("button", { name: "Log In" }));
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
  await click(page.getByTitle("Switch to dark mode"));
  await beat(page);
  await click(page.getByTitle("Switch to light mode"));
  await beat(page);

  mark("create app");
  await click(page.getByRole("link", { name: "New App" }));
  await expect(page.getByText("App Name", { exact: true })).toBeVisible();
  await fillLabeled(page, "App Name", appName);
  await chooseDropdown(row(page, "Owner"), EMAIL);
  await chooseDropdown(row(page, "Platform"), "android");
  await fillLabeled(page, "Package Name", packageName);
  await beat(page);
  await click(page.getByRole("button", { name: "Save" }));
  await expect(page.getByText(appName, { exact: true }).first()).toBeVisible();
  await beat(page);

  mark("edit app");
  await click(page.getByRole("link", { name: "Edit" }));
  await fillLabeled(page, "App Name", renamed);
  await click(page.getByRole("button", { name: "Save" }));
  await expect(page.getByText("App updated!")).toBeVisible();
  await click(page.getByRole("button", { name: "Back" }));
  await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();
  await beat(page);

  mark("profiles");
  await createProfile(page, "BidMachine");
  await createProfile(page, "AppLovin");

  mark("banner");
  const banner = await createAuction(page, {
    name: bannerName,
    adType: "banner",
    floor: "1.50",
    bidFloor: "0.80",
    zoneId: `zone-banner-${stamp}`,
    stamp,
  });

  mark("interstitial");
  const interstitial = await createAuction(page, {
    name: interstitialName,
    adType: "interstitial",
    floor: "2.50",
    bidFloor: "1.20",
    zoneId: `zone-interstitial-${stamp}`,
    stamp,
  });

  mark("rewarded");
  const rewarded = await createAuction(page, {
    name: rewardedName,
    adType: "rewarded",
    floor: "3.50",
    bidFloor: "1.80",
    zoneId: `zone-rewarded-${stamp}`,
    stamp,
  });

  mark("edit auction");
  const bannerCard = namedCard(page, bannerName);
  await click(bannerCard.getByRole("button", { name: "Edit", exact: true }));
  const editForm = page.locator(".inline-auction-config-form");
  await fillLabeled(editForm, "Name", bannerRenamed);
  await click(editForm.getByRole("button", { name: "Save" }));
  await expect(page.getByText("Auction configuration updated!")).toBeVisible();
  const renamedCard = namedCard(page, bannerRenamed);
  await expect(renamedCard).toBeVisible();
  await beat(page);

  mark("edit line item");
  const waterfallLine = lineRow(renamedCard, banner.waterfallLabel);
  await click(waterfallLine.getByRole("button", { name: "Edit line item" }));
  const editedWaterfall = `${banner.waterfallLabel} v2`;
  await fillLabeled(renamedCard, "Label", editedWaterfall);
  await click(renamedCard.getByRole("button", { name: "Update" }));
  await expect(page.getByText("Line item updated.")).toBeVisible();
  await expect(lineRow(renamedCard, editedWaterfall)).toBeVisible();
  await beat(page);

  mark("delete");
  await deleteAuction(page, bannerRenamed, [editedWaterfall, banner.biddingLabel]);
  await deleteAuction(page, interstitialName, [
    interstitial.waterfallLabel,
    interstitial.biddingLabel,
  ]);
  await deleteAuction(page, rewardedName, [
    rewarded.waterfallLabel,
    rewarded.biddingLabel,
  ]);

  await deleteProfile(page, "AppLovin");
  await deleteProfile(page, "BidMachine");

  await click(
    page
      .locator(".card")
      .filter({ hasText: renamed })
      .getByRole("button", { name: "Delete", exact: true }),
  );
  await confirm(page);
  await expect(page).toHaveURL(/\/apps\/?$/);
  await expect(page.getByRole("link", { name: "New App" })).toBeVisible();
});

async function beat(page: Page) {
  await page.waitForTimeout(2_200);
}

async function click(locator: Locator) {
  await locator.click();
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
  await click(input);
  await input.fill("");
  await input.pressSequentially(value, { delay: 45 });
}

async function chooseDropdown(field: Locator, option: string) {
  const page = field.page();
  const dropdown = field.locator(".p-dropdown");
  await click(dropdown);
  const panel = page.locator(".p-dropdown-panel").last();
  try {
    await expect(panel).toBeVisible({ timeout: 2_500 });
  } catch {
    await dropdown.click();
    await expect(panel).toBeVisible();
  }
  await page.waitForTimeout(600);
  const filter = panel.locator("input");
  if ((await filter.count()) > 0) {
    await filter.fill(option);
  }
  const choice = panel.getByRole("option", { name: option, exact: true });
  await expect(choice).toBeVisible();
  await click(choice);
}

async function createAuction(
  page: Page,
  spec: {
    name: string;
    adType: string;
    floor: string;
    bidFloor: string;
    zoneId: string;
    stamp: string;
  },
) {
  const biddingLabel = `BidMachine ${spec.adType} ${spec.stamp}`;
  const waterfallLabel = `AppLovin ${spec.adType} ${spec.stamp}`;
  await click(page.locator("button:visible", { hasText: "New Auction Config" }));
  const form = page.locator(".inline-auction-config-form");
  await expect(form).toBeVisible();
  await fillLabeled(form, "Name", spec.name);
  await chooseDropdown(row(form, "Ad Type"), spec.adType);
  await fillLabeled(form, "Price floor", spec.floor);
  await beat(page);

  const bidding = networkCard(form, "Bidding Networks", "BidMachine");
  await click(bidding.getByRole("button", { name: "Disabled" }));
  await expect(bidding.getByRole("button", { name: "Enabled" })).toBeVisible();
  await click(bidding.getByRole("button", { name: "New line item" }));
  await fillLabeled(bidding, "Label", biddingLabel);
  await click(bidding.getByRole("button", { name: "Save" }));
  await expect(page.getByText("Line item created.").last()).toBeVisible();
  await expect(bidding.getByText(biddingLabel, { exact: true })).toBeVisible();
  await beat(page);

  const waterfall = networkCard(form, "Waterfall Networks", "AppLovin");
  await click(waterfall.getByRole("button", { name: "Disabled" }));
  await expect(waterfall.getByRole("button", { name: "Enabled" })).toBeVisible();
  await click(waterfall.getByRole("button", { name: "New line item" }));
  await fillLabeled(waterfall, "Label", waterfallLabel);
  await fillLabeled(waterfall, "Zone Id", spec.zoneId);
  await fillLabeled(waterfall, "Bid Floor", spec.bidFloor);
  await click(waterfall.getByRole("button", { name: "Save" }));
  await expect(page.getByText("Line item created.").last()).toBeVisible();
  await expect(waterfall.getByText(waterfallLabel, { exact: true })).toBeVisible();
  await beat(page);

  await click(form.getByRole("button", { name: "Save" }));
  await expect(page.getByText("Auction configuration created!")).toBeVisible();
  await expect(namedCard(page, spec.name)).toBeVisible();
  await beat(page);
  return { biddingLabel, waterfallLabel };
}

async function deleteAuction(page: Page, name: string, lineLabels: string[]) {
  const card = namedCard(page, name);
  for (const label of lineLabels) {
    await click(lineRow(card, label).getByRole("button", { name: "Delete line item" }));
    await confirm(page);
    await expect(page.getByText("Line item deleted.").last()).toBeVisible();
  }
  await click(card.getByRole("button", { name: "Delete", exact: true }));
  await confirm(page);
  await expect(page.getByText("Auction configuration deleted.").last()).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await beat(page);
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
  await click(section.getByRole("button", { name: "Create Profile" }));
  // The heading gains the network name once one is chosen, so keep the form
  // anchored to the section instead of that text.
  const form = section.locator("div.rounded-lg").first();
  await chooseDropdown(row(form, "Network"), network);
  await click(form.getByRole("button", { name: "Save" }));
  await expect(page.getByText("Demand source profile created.").last()).toBeVisible();
  await expect(namedCard(page, network)).toBeVisible();
  await beat(page);
}

async function deleteProfile(page: Page, network: string) {
  await click(namedCard(page, network).getByRole("button", { name: "Delete profile" }));
  await confirm(page);
  await expect(page.getByText("Demand source profile deleted.").last()).toBeVisible();
  await beat(page);
}

async function confirm(page: Page) {
  const dialog = page.locator(".p-confirm-dialog");
  await expect(dialog).toBeVisible();
  await beat(page);
  await click(dialog.getByRole("button", { name: "Yes" }));
}
