# GTD Onboarding Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After registration, guide users through setting up GTD context lists with locations and device contexts via a full-page stepper wizard.

**Architecture:** New `onboardingCompleted` boolean on users table (default `true` so existing users skip wizard). Registration sets it to `false`. App layout redirects incomplete users to `/onboarding`. Single GraphQL mutation `completeOnboarding` atomically creates lists, locations, and marks onboarding done.

**Tech Stack:** Next.js App Router, Drizzle ORM, Pothos GraphQL, Apollo Client, Tailwind/shadcn, useGeocode hook, NearbyProvider

---

### Task 1: DB Schema + User Entity

**Files:**
- Modify: `src/server/db/schema/auth.ts:18-19` (add column after calendarSyncAll)
- Modify: `src/domain/entities/user.ts:1-14` (add field to User interface)

**Step 1: Add `onboardingCompleted` column to users schema**

In `src/server/db/schema/auth.ts`, add after line 18 (`calendarSyncAll`):

```typescript
onboardingCompleted: boolean("onboarding_completed").notNull().default(true),
```

Default is `true` so all existing users skip wizard. New users will have it explicitly set to `false` during registration.

**Step 2: Update User entity interface**

In `src/domain/entities/user.ts`, add to the `User` interface before `calendarSyncAll`:

```typescript
onboardingCompleted: boolean;
```

**Step 3: Push schema to DB**

Run: `yarn db:push`
Expected: Schema synced successfully

**Step 4: Commit**

```bash
git add src/server/db/schema/auth.ts src/domain/entities/user.ts
git commit -m "feat: add onboardingCompleted column to users table"
```

---

### Task 2: User Repository + Auth Service

**Files:**
- Modify: `src/domain/repositories/user.repository.ts:3-12` (add method)
- Modify: `src/infrastructure/persistence/drizzle-user.repository.ts` (implement method)
- Modify: `src/domain/services/auth.service.ts` (add method)

**Step 1: Add `markOnboardingCompleted` to IUserRepository**

In `src/domain/repositories/user.repository.ts`, add before the closing `}`:

```typescript
markOnboardingCompleted(userId: string): Promise<void>;
```

**Step 2: Implement in DrizzleUserRepository**

In `src/infrastructure/persistence/drizzle-user.repository.ts`, add method:

```typescript
async markOnboardingCompleted(userId: string): Promise<void> {
  await this.db
    .update(schema.users)
    .set({ onboardingCompleted: true })
    .where(eq(schema.users.id, userId));
}
```

**Step 3: Add to AuthService**

In `src/domain/services/auth.service.ts`, add method:

```typescript
async markOnboardingCompleted(userId: string): Promise<void> {
  return this.userRepo.markOnboardingCompleted(userId);
}
```

**Step 4: Verify typecheck passes**

Run: `yarn typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/domain/repositories/user.repository.ts src/infrastructure/persistence/drizzle-user.repository.ts src/domain/services/auth.service.ts
git commit -m "feat: add markOnboardingCompleted to user repository and auth service"
```

---

### Task 3: Auth.js JWT/Session — pass onboardingCompleted

**Files:**
- Modify: `src/lib/auth.ts:49-62` (jwt and session callbacks)

**Step 1: Extend JWT callback to include onboardingCompleted**

In `src/lib/auth.ts`, replace the `callbacks` object (lines 49-62):

```typescript
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = user.id;
    }
    // Refresh onboardingCompleted from DB on every token refresh
    if (token.id && (trigger === "signIn" || trigger === "signUp" || trigger === "update")) {
      const dbUser = await services.auth.getById(token.id as string);
      if (dbUser) {
        token.onboardingCompleted = dbUser.onboardingCompleted;
      }
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user && token.id) {
      session.user.id = token.id as string;
      session.user.onboardingCompleted = token.onboardingCompleted as boolean;
    }
    return session;
  },
},
```

**Step 2: Add TypeScript type augmentation**

Create type augmentation at the top of `src/lib/auth.ts` (after imports, before the export):

```typescript
declare module "next-auth" {
  interface User {
    onboardingCompleted?: boolean;
  }
  interface Session {
    user: {
      id: string;
      onboardingCompleted?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    onboardingCompleted?: boolean;
  }
}
```

Add `import type { DefaultSession } from "next-auth";` to imports.

**Step 3: Verify typecheck passes**

Run: `yarn typecheck`

**Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: pass onboardingCompleted through JWT/session callbacks"
```

---

### Task 4: Registration flow — set onboardingCompleted to false

**Files:**
- Modify: `src/server/graphql/types/register.ts:17-21` (set flag after creating user)
- Modify: `src/components/auth/register-form.tsx:85` (change redirect)
- Modify: `src/components/auth/oauth-buttons.tsx:15,40` (change callbackUrl)
- Modify: `src/lib/auth.ts:42-48` (set flag in createUser event)

**Step 1: Set onboardingCompleted=false in register mutation**

In `src/server/graphql/types/register.ts`, the resolve function should also mark onboarding as not completed. After `await ctx.services.list.createDefaultList(user.id);`, add:

```typescript
// New users need onboarding
await ctx.services.auth.markOnboardingCompleted(user.id);
```

Wait — this marks it as completed. We need the opposite. Instead, we rely on the DB default being `true` for existing users. For new users via credentials, the register mutation creates the user with default `true`, but we need to set it to `false`.

Add a new method `setOnboardingPending` to auth service/repo, OR just directly update in the resolver. Simpler: add `setOnboardingCompleted(userId, value)` method.

**Actually, simplify:** Change the DB default to `false` and in the `createUser` event (for OAuth), check if the user has no lists and set accordingly. OR: keep default `true`, add a repo method `setOnboardingPending`.

**Simplest approach:** Add `updateOnboardingCompleted(userId: string, completed: boolean)` to the repo/service.

In `src/domain/repositories/user.repository.ts`, replace `markOnboardingCompleted` with:

```typescript
updateOnboardingCompleted(userId: string, completed: boolean): Promise<void>;
```

In `src/infrastructure/persistence/drizzle-user.repository.ts`:

```typescript
async updateOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
  await this.db
    .update(schema.users)
    .set({ onboardingCompleted: completed })
    .where(eq(schema.users.id, userId));
}
```

In `src/domain/services/auth.service.ts`:

```typescript
async updateOnboardingCompleted(userId: string, completed: boolean): Promise<void> {
  return this.userRepo.updateOnboardingCompleted(userId, completed);
}
```

Then in `src/server/graphql/types/register.ts` resolve, after creating default list:

```typescript
await ctx.services.auth.updateOnboardingCompleted(user.id, false);
```

In `src/lib/auth.ts` createUser event (OAuth users), after creating default list:

```typescript
await services.auth.updateOnboardingCompleted(user.id, false);
```

**Step 2: Change registration redirect to /onboarding**

In `src/components/auth/register-form.tsx`, change line 85:

```typescript
router.push("/onboarding");
```

**Step 3: Change OAuth callbackUrl**

In `src/components/auth/oauth-buttons.tsx`, change both callbackUrl values from `"/planned"` to `"/onboarding"`:

```typescript
signIn("google", { callbackUrl: "/onboarding" })
signIn("github", { callbackUrl: "/onboarding" })
```

**Step 4: Verify typecheck**

Run: `yarn typecheck`

**Step 5: Commit**

```bash
git add src/server/graphql/types/register.ts src/components/auth/register-form.tsx src/components/auth/oauth-buttons.tsx src/lib/auth.ts src/domain/repositories/user.repository.ts src/infrastructure/persistence/drizzle-user.repository.ts src/domain/services/auth.service.ts
git commit -m "feat: set onboardingCompleted=false for new users, redirect to /onboarding"
```

---

### Task 5: App layout — redirect to onboarding if not completed

**Files:**
- Modify: `src/app/(app)/layout.tsx` (add onboarding check)

**Step 1: Add onboarding redirect**

Replace the entire `src/app/(app)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.onboardingCompleted) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "feat: redirect users with incomplete onboarding to /onboarding"
```

---

### Task 6: GraphQL mutation — completeOnboarding

**Files:**
- Create: `src/server/graphql/types/onboarding.ts`
- Modify: `src/server/graphql/types/register.ts` (import new file in register.ts or register in schema)

**Step 1: Check how types are registered**

Read `src/server/graphql/types/register.ts` — this file just uses builder side-effects. Check `src/server/graphql/schema.ts` to see how types are imported.

**Step 2: Create onboarding GraphQL types**

Create `src/server/graphql/types/onboarding.ts`:

```typescript
import { builder } from "../builder";

const OnboardingLocationInput = builder.inputType("OnboardingLocationInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    latitude: t.float({ required: true }),
    longitude: t.float({ required: true }),
    address: t.string(),
  }),
});

const OnboardingListInput = builder.inputType("OnboardingListInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    deviceContext: t.string(),
    location: t.field({ type: OnboardingLocationInput }),
  }),
});

const CompleteOnboardingInput = builder.inputType("CompleteOnboardingInput", {
  fields: (t) => ({
    lists: t.field({ type: [OnboardingListInput], required: true }),
  }),
});

builder.mutationField("completeOnboarding", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    args: { input: t.arg({ type: CompleteOnboardingInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      if (!ctx.userId) throw new Error("Not authenticated");

      const { lists } = args.input;

      for (let i = 0; i < lists.length; i++) {
        const listInput = lists[i];
        let locationId: string | null = null;

        // Create location if provided
        if (listInput.location) {
          const location = await ctx.services.location.create(ctx.userId, {
            name: listInput.location.name,
            latitude: listInput.location.latitude,
            longitude: listInput.location.longitude,
            address: listInput.location.address ?? null,
          });
          locationId = location.id;
        }

        // Create list
        const list = await ctx.services.list.create(ctx.userId, {
          name: listInput.name,
        });

        // Update with deviceContext and/or locationId if needed
        if (listInput.deviceContext || locationId) {
          await ctx.services.list.update(list.id, ctx.userId, {
            deviceContext: listInput.deviceContext ?? null,
            locationId,
          });
        }
      }

      // Mark onboarding as completed
      await ctx.services.auth.updateOnboardingCompleted(ctx.userId, true);

      return true;
    },
  }),
);

builder.mutationField("skipOnboarding", (t) =>
  t.boolean({
    authScopes: { authenticated: true },
    resolve: async (_root, _args, ctx) => {
      if (!ctx.userId) throw new Error("Not authenticated");
      await ctx.services.auth.updateOnboardingCompleted(ctx.userId, true);
      return true;
    },
  }),
);
```

**Step 3: Register the new type file in schema**

Check `src/server/graphql/schema.ts` or wherever types are registered, and add:

```typescript
import "./types/onboarding";
```

**Step 4: Verify typecheck and codegen**

Run: `yarn typecheck && yarn codegen`

**Step 5: Commit**

```bash
git add src/server/graphql/types/onboarding.ts src/server/graphql/schema.ts
git commit -m "feat: add completeOnboarding and skipOnboarding GraphQL mutations"
```

---

### Task 7: i18n translations

**Files:**
- Modify: `src/lib/i18n/types.ts` (add onboarding section to Dictionary)
- Modify: `src/lib/i18n/dictionaries/cs.ts` (add Czech translations)
- Modify: `src/lib/i18n/dictionaries/en.ts` (add English translations)

**Step 1: Add onboarding type to Dictionary**

In `src/lib/i18n/types.ts`, add before the closing `}` of the `Dictionary` interface (before line 230):

```typescript
onboarding: {
  introTitle: string;
  introDescription: string;
  introStart: string;
  introSkip: string;
  listsTitle: string;
  listsDescription: string;
  listsContinue: string;
  listsSkip: string;
  homeTitle: string;
  homeDescription: string;
  homeSkip: string;
  homeContinue: string;
  workTitle: string;
  workDescription: string;
  workSkip: string;
  workContinue: string;
  doneTitle: string;
  doneDescription: string;
  doneCreatedLists: string;
  doneStart: string;
  listHome: string;
  listWork: string;
  listComputer: string;
  listPhoneCalls: string;
  listErrands: string;
  listWaitingFor: string;
  listSomedayMaybe: string;
  listOther: string;
  searchLocation: string;
  currentLocation: string;
  step: string;
};
```

**Step 2: Add Czech translations**

In `src/lib/i18n/dictionaries/cs.ts`, add before the closing `};`:

```typescript
onboarding: {
  introTitle: "Chceš nastavit SweptMind pro GTD?",
  introDescription: "Vytvoříme ti seznamy pro kontexty, přiřadíme lokace a nastavíme zařízení. Zabere to minutu.",
  introStart: "Ano, nastav to",
  introSkip: "Přeskočit",
  listsTitle: "Jaké seznamy chceš?",
  listsDescription: "Vyber si kontextové seznamy, které ti dávají smysl. Můžeš je později změnit.",
  listsContinue: "Pokračovat",
  listsSkip: "Přeskočit",
  homeTitle: "Kde bydlíš?",
  homeDescription: "Přiřadíme lokaci seznamu \"Doma\", aby se ti úkoly zvýraznily, když jsi doma.",
  homeSkip: "Přeskočit",
  homeContinue: "Pokračovat",
  workTitle: "Kde pracuješ?",
  workDescription: "Přiřadíme lokaci seznamu \"V práci\", aby se ti úkoly zvýraznily v práci.",
  workSkip: "Přeskočit",
  workContinue: "Pokračovat",
  doneTitle: "Hotovo!",
  doneDescription: "Tvůj SweptMind je připravený pro GTD.",
  doneCreatedLists: "Vytvořili jsme {count} seznamů",
  doneStart: "Začít používat SweptMind",
  listHome: "Doma",
  listWork: "V práci",
  listComputer: "U počítače",
  listPhoneCalls: "Telefonáty",
  listErrands: "Pochůzky",
  listWaitingFor: "Čekám na",
  listSomedayMaybe: "Někdy/Možná",
  listOther: "Ostatní",
  searchLocation: "Hledat místo...",
  currentLocation: "Aktuální poloha",
  step: "Krok {current} z {total}",
},
```

**Step 3: Add English translations**

In `src/lib/i18n/dictionaries/en.ts`, add before the closing `};`:

```typescript
onboarding: {
  introTitle: "Want to set up SweptMind for GTD?",
  introDescription: "We'll create context lists, assign locations, and set up device contexts. Takes about a minute.",
  introStart: "Yes, set it up",
  introSkip: "Skip",
  listsTitle: "Which lists do you want?",
  listsDescription: "Choose the context lists that make sense for you. You can always change them later.",
  listsContinue: "Continue",
  listsSkip: "Skip",
  homeTitle: "Where do you live?",
  homeDescription: "We'll assign a location to the \"Home\" list so your tasks highlight when you're home.",
  homeSkip: "Skip",
  homeContinue: "Continue",
  workTitle: "Where do you work?",
  workDescription: "We'll assign a location to the \"At Work\" list so your tasks highlight at work.",
  workSkip: "Skip",
  workContinue: "Continue",
  doneTitle: "All set!",
  doneDescription: "Your SweptMind is ready for GTD.",
  doneCreatedLists: "Created {count} lists",
  doneStart: "Start using SweptMind",
  listHome: "Home",
  listWork: "At Work",
  listComputer: "At Computer",
  listPhoneCalls: "Phone Calls",
  listErrands: "Errands",
  listWaitingFor: "Waiting For",
  listSomedayMaybe: "Someday/Maybe",
  listOther: "Other",
  searchLocation: "Search for a place...",
  currentLocation: "Current location",
  step: "Step {current} of {total}",
},
```

**Step 4: Verify typecheck**

Run: `yarn typecheck`

**Step 5: Commit**

```bash
git add src/lib/i18n/types.ts src/lib/i18n/dictionaries/cs.ts src/lib/i18n/dictionaries/en.ts
git commit -m "feat: add onboarding i18n translations (cs/en)"
```

---

### Task 8: Onboarding page — stepper UI

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/layout.tsx`

This is a client component with multi-step wizard. It lives outside `(app)` and `(auth)` route groups so it has its own layout (no sidebar, no auth card styling).

**Step 1: Create onboarding layout**

Create `src/app/onboarding/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.onboardingCompleted) {
    redirect("/planned");
  }

  return <>{children}</>;
}
```

**Step 2: Create onboarding page**

Create `src/app/onboarding/page.tsx` — this is a large client component with the 5-step wizard.

The page should:
1. Use `useState` to track current step (0-4) and form state
2. Use `useTranslations()` for i18n
3. Use `useGeocode()` for location search in steps 3-4
4. Use `useNearby()` for pre-filling home location in step 3
5. Use Apollo `useMutation` for `completeOnboarding` and `skipOnboarding`
6. Use `useRouter` for navigation after completion
7. Use `update` on Apollo mutation to trigger session refresh

Key state:
```typescript
const [step, setStep] = useState(0);
const [selectedLists, setSelectedLists] = useState<Record<string, boolean>>({
  home: true, work: true, computer: true, phoneCalls: true,
  errands: true, waitingFor: true, somedayMaybe: true, other: true,
});
const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
const [workLocation, setWorkLocation] = useState<LocationData | null>(null);
```

List definitions (map keys to i18n names and configs):
```typescript
const LIST_DEFS = [
  { key: "home", i18nKey: "listHome" as const, hasLocation: true, deviceContext: null },
  { key: "work", i18nKey: "listWork" as const, hasLocation: true, deviceContext: null },
  { key: "computer", i18nKey: "listComputer" as const, hasLocation: false, deviceContext: "computer" },
  { key: "phoneCalls", i18nKey: "listPhoneCalls" as const, hasLocation: false, deviceContext: "phone" },
  { key: "errands", i18nKey: "listErrands" as const, hasLocation: false, deviceContext: null },
  { key: "waitingFor", i18nKey: "listWaitingFor" as const, hasLocation: false, deviceContext: null },
  { key: "somedayMaybe", i18nKey: "listSomedayMaybe" as const, hasLocation: false, deviceContext: null },
  { key: "other", i18nKey: "listOther" as const, hasLocation: false, deviceContext: null },
];
```

Step navigation logic:
- Step 0 (Intro): always shown
- Step 1 (Lists): always shown
- Step 2 (Home): shown only if `selectedLists.home`
- Step 3 (Work): shown only if `selectedLists.work`
- Step 4 (Done): always shown

On "Continue" from step 1, skip to step 4 if neither home nor work selected. Similarly skip step 3 if work not selected.

On "Done" (step 4): call `completeOnboarding` mutation with selected lists and locations, then `router.push("/planned")` + `router.refresh()`.

On "Skip" (any step): call `skipOnboarding` mutation, then `router.push("/planned")` + `router.refresh()`.

**Step 3: Wrap with NearbyProvider if needed**

The onboarding page needs `NearbyProvider` for geolocation. Check if it's available at this route level. If not, wrap the page content with it, or better — import `useNearby` and if the provider isn't available, just skip pre-filling.

Actually, since the onboarding layout is outside `(app)`, the NearbyProvider won't be available. We should either:
- a) Import and use the geolocation API directly (simpler)
- b) Wrap with NearbyProvider in the onboarding layout

Option a is simpler: just use `navigator.geolocation.getCurrentPosition()` directly in the component for pre-filling the home step.

**Step 4: Style the wizard**

Use shadcn components: Card, Button, Checkbox, Input (for location search). Full-page centered layout with max-w-lg. Progress indicator (step dots or "Step X of Y" text).

Use lucide icons for list items:
- Home: `Home` icon (green indicator)
- Work: `Briefcase` icon (green indicator)
- Computer: `Monitor` icon (yellow indicator)
- Phone Calls: `Smartphone` icon (yellow indicator)
- Errands: `ShoppingBag` icon
- Waiting For: `Clock` icon
- Someday/Maybe: `Lightbulb` icon
- Other: `List` icon

Location search: reuse the same pattern from tag/list pages — `Command` + `CommandInput` + `CommandList` with geocoding results.

**Step 5: Verify typecheck and test in browser**

Run: `yarn typecheck`
Run: `yarn dev` and test the flow

**Step 6: Commit**

```bash
git add src/app/onboarding/
git commit -m "feat: add GTD onboarding wizard with multi-step setup"
```

---

### Task 9: Verification and cleanup

**Step 1: Run full check suite**

Run: `yarn check`
Expected: lint, format, typecheck, and tests all pass

**Step 2: Test the full flow manually**

1. Register a new user → should redirect to `/onboarding`
2. Step through wizard → lists created correctly
3. Skip wizard → redirects to `/planned` with just default "Tasks" list
4. Existing user login → should go straight to `/planned` (no wizard)

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: onboarding wizard cleanup"
```
