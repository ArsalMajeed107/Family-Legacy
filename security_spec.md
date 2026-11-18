# FamilyRoots AI — Security Specification & Dirty Dozen Threat Model

## 1. Data Invariants

1. **Identity Integrity**: Every user profile in `users/{userId}` must match `request.auth.uid` on creation, and a self-registering user can never assign themselves an elevated role (`developer_super_admin`, `family_head`, `branch_admin`). Only the bootstrapped Developer Super Admin (`arsalmajeed287@gmail.com` with `email_verified == true`) or an existing `developer_super_admin` may grant elevated roles.
2. **PII Isolation (Split Collection)**: Genealogy profiles in `members/{memberId}` do NOT store private PII (`email`, `phone`, `address`). Sensitive contact fields reside exclusively in `memberPrivateInfo/{memberId}`, readable only by the linked user (`linkedUid == request.auth.uid`), Main Family Head, or Developer Super Admin.
3. **Centralized Relationship Governance**: Ordinary verified or pending family members cannot directly create, modify, or delete records in `members`, `branches`, or `auditLogs`. Only `family_head`, `branch_admin` (for verified member updates), or `developer_super_admin` may write verified genealogy data.
4. **Registration Workflow Integrity**: Pending users can submit `registrationRequests/{requestId}` only with `requesterUid == request.auth.uid` and `status == 'pending'`. Only Family Head / Branch Admin / Developer Super Admin can transition `status` to `'approved'` or `'rejected'`.
5. **Developer-Only System Control**: `systemSettings/global` can only be created or modified by `developer_super_admin`. Main Family Head and ordinary members have zero write access to system configuration.
6. **AI Conversation Privacy**: Chat messages under `aiConversations/{userId}/messages/{messageId}` are strictly scoped to `userId == request.auth.uid`.
7. **Temporal & Schema Strictness**: All writes enforce strict field allowlists (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update), bounded string sizes, regex-validated document IDs (`isValidId`), and server-validated timestamps (`request.time`).

## 2. The "Dirty Dozen" Attack Payloads

1. **Self-Privilege Escalation on Signup**: Creating `users/{uid}` with `{ uid, email, role: "developer_super_admin" }` as a non-developer user -> MUST return `PERMISSION_DENIED`.
2. **Role Tampering on Profile Update**: Updating own `users/{uid}` document with `{ role: "family_head" }` -> MUST return `PERMISSION_DENIED`.
3. **Shadow Field Injection on Member Creation**: Creating `members/{id}` with an unexpected extra key `{ ..., isAdminOverride: true }` -> MUST return `PERMISSION_DENIED`.
4. **Unauthorized Member Record Creation**: Verified ordinary member attempting to create `members/{id}` directly without Family Head / Admin authorization -> MUST return `PERMISSION_DENIED`.
5. **PII Scraping (`memberPrivateInfo` list/get)**: Authenticated ordinary member reading `memberPrivateInfo/{otherMemberId}` or listing all `memberPrivateInfo` -> MUST return `PERMISSION_DENIED`.
6. **Users Collection Scraping**: Ordinary member executing a `list` query on `users` to enumerate family emails -> MUST return `PERMISSION_DENIED`.
7. **System Settings Hijack by Family Head**: `family_head` user attempting to update `systemSettings/global` -> MUST return `PERMISSION_DENIED`.
8. **Auto-Approving Own Registration Request**: Pending user creating `registrationRequests/{id}` with `status: "approved"` -> MUST return `PERMISSION_DENIED`.
9. **Approval Tampering on Update**: Pending user updating their own `registrationRequests/{id}` to `status: "approved"` -> MUST return `PERMISSION_DENIED`.
10. **ID Poisoning / Resource Exhaustion**: Writing a 1.5KB junk document ID or a 50KB biography string -> MUST return `PERMISSION_DENIED`.
11. **Unverified Email Spoofing**: Authenticated user with `email_verified: false` attempting admin or write actions -> MUST return `PERMISSION_DENIED`.
12. **Audit Log Forgery / Deletion**: Any user attempting to delete or alter an existing `auditLogs/{logId}` entry -> MUST return `PERMISSION_DENIED`.
