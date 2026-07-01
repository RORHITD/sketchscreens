# SketchScreens — extraction prompt

You are extracting a **ProjectMap** from a codebase: the screens of one surface, the UI elements on each, and the navigation flow between them. Your output is consumed by a renderer that draws each screen as a hand-drawn sketch wireframe. Fidelity is **structural, not pixel-perfect** — get the *right elements in roughly the right order*, not exact positions.

## The output contract

Produce a single JSON object matching this shape (validated by `@sketchscreens/core-schema`):

```jsonc
{
  "version": 1,
  "name": "<Display name, e.g. 'AI Phone 360 — Web App'>",
  "surface": "web",            // web | mobile | crm | admin | backend | desktop | other
  "meta": { "generator": "sketchscreens-agent", "repoRoot": "<abs path>", "extraction": "agent" },
  "screens": [
    {
      "id": "login",                       // stable, unique, kebab-case
      "name": "Login",                     // human-friendly
      "route": "/auth",                    // URL path, widget class, or API group
      "sourceFile": "src/components/auth/LoginForm.tsx",  // repo-relative
      "description": "Optional one-line purpose",
      "group": "Auth",                     // hierarchy path (see "Hierarchy" below)
      "elements": [                        // ORDERED top-to-bottom = the vertical stack
        { "type": "heading",  "label": "Create your account" },
        { "type": "input",    "label": "Phone number", "required": true },
        { "type": "button",   "label": "Continue", "variant": "primary" }
      ]
    }
  ],
  "edges": [
    { "from": "login", "to": "verify", "trigger": "Continue", "kind": "push" }
  ]
}
```

**`element.type` is a closed enum** — use only these:
`heading | text | input | textarea | button | checkbox | radio | toggle | select | listbox | card | image | list | divider | nav | tabs`

- `label` = the visible text (button caption, field label, heading text).
- `variant` (buttons): `primary | secondary | destructive | ghost | link`.
- `secure: true` for password fields; `required: true` if the source marks it required.
- element `group` = an optional key; elements sharing it render inside one card/section (distinct from the screen-level `group` below).

## The journey — `parent`, `isEntry`, and `group`

The renderer draws a **single top-down journey tree**, rooted at what the user sees FIRST, flowing the way people actually navigate. Model that, don't just bucket by feature:

**`isEntry`** — mark exactly ONE screen as the entry point (`isEntry: true`): the first thing a user hits — a splash/launch screen, or the auth screen if there's no splash. The tree roots here.

**`parent`** — set each screen's `parent` to the id of the screen a user reaches it FROM. This is the backbone:
- The **entry** screen has no parent.
- **Auth** screens hang off the entry. If sign-up and login are distinct journeys, model them as separate branches (a "Sign Up" screen and a "Login" screen, each → its own Verify), even if they reuse a component — set their `name`/`id` to reflect the path.
- The **main screen** (dashboard/home) is the hub the app opens into; its parent is the last auth/onboarding step.
- Each **feature section's hub** (Calls, Contacts, Settings, Billing…) has `parent: <dashboard id>`. Each **sub-screen** has `parent: <its section hub id>` (e.g. Call Detail → Calls; AI Settings Voice → AI Settings; AI Settings → Settings).
- A screen you can't place still renders — parentless non-root screens attach to the root automatically.

Keep the backbone to the *primary* way in. Secondary/cross links (e.g. a call row → a contact) are captured as `edges` (drawn faint), not as `parent`.

**`group`** — a `" › "` label path for the section a screen belongs to (`"Settings › AI Settings"`), usually derived from the route (`/calls*` → "Calls"; `/ai-settings/*` → "Settings › AI Settings"). Shown as a small section badge on the screen. Complements `parent` (which gives the shape); `group` gives the label.

## Method (agent-first)

1. **Pick the surface + its root.** One map = one surface. If the repo holds several (web + mobile + backend), map the one you were asked for.
2. **Enumerate screens** using the stack profile below. Produce a screen per real, reachable screen — skip pure layouts, error boundaries, and API-only files.
3. **For each screen, read its component to list elements.** Screens are often *thin* — a route file that just renders `<LoginForm />`. **Follow the import to the real component** and read *that* file's fields/buttons/headings. Resolve string constants (e.g. `AppString.continueWithPhone`) to their values when cheap.
4. **List elements top-to-bottom in source order.** A form with 3 fields + a submit button → 3 `input` + 1 `button`. Don't invent elements that aren't there; don't omit obvious ones.
5. **Infer edges** from navigation calls (see profile). The `trigger` is usually the button/link label that causes the transition.
6. **Build the journey** per *The journey* section — mark the `isEntry` screen, set each screen's `parent` to what it's reached from (entry → auth → dashboard → sections), and set `group` labels. The result should read as: first screen → sign-up/login → main screen → feature areas.
7. **Keep it honest.** If a screen's elements are genuinely dynamic/unknowable, emit the ones you can see and add a `note`. A smaller true map beats a padded guessed one.

## Stack profiles (parse signals)

### Next.js (App Router)
- **Screens** = files `src/app/**/page.tsx` (or `app/**/page.tsx`). Route = the directory path with `(group)` segments removed and `[param]` → `:param`. Skip `layout.tsx` / `route.ts`.
- **Thin-page rule applies hard here** — `page.tsx` usually renders a component from `src/components/**`. Follow it for the elements.
- **Elements**: `<Button>Label</Button>` (child text = label, `variant`/`type` = role), `@/components/ui/*` field tags (`<Input>`, `<Select>`, `<Switch>` → toggle, `<Textarea>`), and react-hook-form field names via the `useForm`/`zodResolver` schema.
- **Edges**: `router.push("/x")`, `<Link href="/x">`, `redirect("/x")` — the string literal is the destination route; match it to a screen's route.

### Next.js (Pages Router)
- **Screens** = files under `pages/**` (excluding `_app`, `_document`, `api/**`). Route = the file path.
- Elements + edges: same JSX signals as App Router.

### Flutter (GetX / Navigator)
- **Screens** = classes matching `class \w+(Screen|Page|View) extends (Stateless|Stateful)Widget`, usually under `lib/module/**/view*/`. A route table (`AppRoutes.routes` with `GetPage(name:, page:)`) may exist but is often **partial** — trust the class scan for completeness; use the table to resolve named routes.
- **Elements** (inside `build()`): `TextFormField` / `TextField` / `IntlPhoneField` / `FormField` → `input` (label = `InputDecoration.hintText`/`labelText`); `ElevatedButton` / `TextButton` / `IconButton` / a `commonBtn(child: Text(...))` factory → `button` (label = the `child:`/`Text`); `Text(...)` → `heading`/`text` (resolve `AppString.*` constants); `Switch`/`Checkbox` → `toggle`/`checkbox`; `DropdownButton` → `select`; `ListView` → `list`.
- **Edges**: destination widget captured from `Get.to/off/offAll(() => SomeScreen())` closures; `Get.toNamed(AppRoutes.x)` joined to the route table; `Navigator.push(... => SomeScreen())`.

### Express / Fastify / Nest (backend surface)
- A backend "screen" is a **route group** (a resource), not a UI. Model each mount as a screen and its endpoints as `list` items, or skip the backend unless asked.
- **Endpoints** = `app.use(\`${PREFIX}/<seg>\`, <router>)` mounts resolved to their route files, then each `router.<verb>('<path>')`. Edges are usually not meaningful for a pure API; prefer a flat map.

### Generic / unknown stack
- Look for a router config or a directory of screen/page/view files. Read a handful of representative components to learn how that stack expresses fields and buttons, then apply the same element/edge extraction. **This is the whole point of agent-first: you can map a stack no profile covers by reading it.**

## Quality bar

- Every `edge.from`/`edge.to` MUST reference a real `screen.id`. No dangling edges, no self-edges.
- Screen ids unique and stable (kebab-case of the route or name).
- Prefer 5–40 screens for a first map of a large app; if there are hundreds, map the primary flow the user cares about and note the scope.
- When done, the map must pass `validateProjectMap` — a helper writes it to `map.json` for you.
