# Security Specification: StockSignalPl

## 1. Data Invariants
1. Users can only access, create, update, or delete their own user profile, portfolios, trades, and settings (`request.auth.uid == userId`).
2. Bootstrapped admin is `slavos1mm@gmail.com` or explicit admin document.
3. Documents must adhere to structural schema validation with string length limits.
4. Anonymous users cannot write to Firestore (`request.auth != null`).

## 2. The "Dirty Dozen" Payloads (Must be rejected)
1. Write to `/users/{otherUserId}` with non-matching `auth.uid`.
2. Write with payload missing required fields (`id`, `name`, etc.).
3. Write with string exceeding `maxLength` (e.g. 500-char name).
4. Updating `userId` on an existing portfolio to hijack ownership.
5. Updating `id` field on an existing trade.
6. Write to `/users/{userId}/portfolios/{portfolioId}` without authentication (`request.auth == null`).
7. Modifying user role to `'admin'` without admin privileges.
8. Writing negative balance or invalid types to numeric fields.
9. Writing arbitrary extra fields not in allowed schema.
10. Unrestricted list query on all users' portfolios.
11. Attempting to delete another user's trade history.
12. Injecting malicious path or oversized ID.
