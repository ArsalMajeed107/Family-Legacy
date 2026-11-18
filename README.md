# Family Legacy (FamilyRoots AI)

A private digital family management, multigenerational genealogy, and AI heritage assistance platform built around the founding lineage of **Muhammad Ghulam** and **Amna Gulam**.

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, jsPDF, plus customizable **Live Heritage Wallpaper** themes (`Midnight Sapphire & Gold` default, `Royal Emerald & Gold`, `Warm Heritage Amber`, `Pashtoon Pink / Rose`)
- **Backend**: Node.js + Express (`server.ts`) serving Vite in development and `dist/` in production, plus `/api/ai/chat` backed by `@google/genai` (`gemini-4-hydrogen`)
- **Database & Authentication (Firebase Disabled)**: Native Express JSON file persistence (`data/fessional-db.json` with in-memory fallback) and `crypto.scryptSync` + HMAC-SHA256 Bearer session authentication. Firebase client/server dependencies are disabled cleanly so email/password authentication and role access work seamlessly out of the box.

## Role-Based Access Control (RBAC)

1. **Developer Super Admin**: Exclusive control over system settings, live wallpaper themes, account/role governance, technical security logs, and founding lineage initialization.
2. **Main Family Head**: Centralized authority over all family members, branches, parent-child/spouse relationships, registration approvals, gallery, announcements, and family history.
3. **Branch Administrator**: Manages members, announcements, gallery items, and registration approvals for family branches.
4. **Verified Family Member**: Explores the full multigenerational family tree, exports PDF chronicles, shares family stories, edits permitted personal details, and accesses FamilyGuide AI.
5. **Pending Family Member**: Can submit registration/profile correction requests and consult FamilyGuide AI while awaiting verification.

## Environment Configuration

See `.env.example`:
- `GEMINI_API_KEY`: Server-side Gemini API key (configured via AI Studio Secrets; never exposed to browser code)
- `APP_URL`: Runtime deployment URL

## Local Development & Verification

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Production Start

```bash
npm run build
NODE_ENV=production npm start
```
