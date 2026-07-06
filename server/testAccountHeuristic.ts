// Shared heuristic for recognizing disposable/automated test accounts.
// Used by: the startup test-account cleanup sweep (seed.ts), the is_test_account
// backfill migration, and account-creation routes that auto-flag new accounts.
//
// REAL_USERNAMES is a hard exclusion list — these usernames are never
// considered test accounts, no matter what their email/username looks like.
export const REAL_USERNAMES = ["Chapin123", "Matt H"];

export const TEST_ACCOUNT_PREFIXES = [
  "e2e",
  "testadmin",
  "testcustomer",
  "tester",
  "profile_test_",
  "calc_",
  "quiztest_",
  "soptype_",
  "tools_",
  "TestCustomer",
];

export const TEST_ACCOUNT_EMAIL_DOMAINS = ["@test.com", "@example.com"];

export function looksLikeTestAccount(username?: string | null, email?: string | null): boolean {
  if (username && REAL_USERNAMES.includes(username)) return false;

  const prefixMatch = !!username && TEST_ACCOUNT_PREFIXES.some((prefix) => username.startsWith(prefix));
  const domainMatch = !!email && TEST_ACCOUNT_EMAIL_DOMAINS.some((domain) => email.includes(domain));

  return prefixMatch || domainMatch;
}
