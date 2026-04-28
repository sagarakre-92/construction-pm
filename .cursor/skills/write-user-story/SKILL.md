---
name: write-user-story
description: Write a user story for the ORAT app as a Gherkin .feature file (Feature + role/want/benefit narrative + Given/When/Then scenarios). Use when the user asks for a user story, acceptance criteria, behavior spec, BDD scenario, Gherkin, or a .feature file.
---

# Write a user story (Gherkin)

User stories in this repo are **written behavior specs**, not executable tests.
They live as `.feature` files alongside the E2E suite so they sit next to the
flows they describe and can later be lifted into Playwright specs.

The canonical example is `e2e/signup-email-verification.feature` — copy its
shape.

## Workflow

```
- [ ] 1. Confirm the user role, the goal, and the benefit (one sentence each)
- [ ] 2. Create e2e/<kebab-name>.feature
- [ ] 3. Write one Feature: header + role/want/benefit narrative
- [ ] 4. Write one Scenario: per observable behavior (happy path + key edges)
- [ ] 5. Use Given (state) → When (action) → Then (observable outcome)
- [ ] 6. Open a beads issue: `bd create --title="..." --type=feature` and link it
```

## File template

```gherkin
Feature: <Short capability, written from the user's perspective>

  As a <role — e.g. project manager, owner's rep, invited teammate>
  I want <capability — what they can do>
  So that <benefit — why it matters to them>

  Scenario: <Observable behavior, present tense>
    Given <starting state>
    When <single user action>
    And <follow-up action, if needed>
    Then <observable outcome the user can verify>
    And <additional outcome>

  Scenario: <A meaningful variation or edge case>
    Given <starting state>
    When <action>
    Then <outcome>
```

## Writing rules

**Feature header**
- One feature per file. The filename is the kebab-case of the feature title
  (e.g. `Feature: Reorder tasks on the board` → `reorder-tasks-on-board.feature`).
- The role/want/benefit narrative is **required** and goes immediately under
  `Feature:`, indented two spaces. Match the shape in
  `e2e/signup-email-verification.feature`.

**Scenarios**
- One scenario per **observable behavior**, not per click. If two `Then`s
  describe the same outcome, collapse them.
- Title the scenario as a sentence describing what happens
  (`Scenario: User adds a task to a project`), not as a test name
  (`Scenario: test_add_task_success`).
- Cover at minimum: the **happy path** + the most consequential **error** or
  **edge** (e.g. cross-org access denied, empty form, conflicting state).

**Given / When / Then**
- `Given` = pre-existing state (the user is signed in, the project exists).
  Never an action.
- `When` = the user's action. Prefer **one** `When` per scenario; chain with
  `And` only when the actions are inseparable.
- `Then` = an outcome the user can **observe** in the UI. Not "the database
  has X" — that's an implementation detail.
- `And` / `But` continue the previous step type.

**Voice**
- Write from the **user's** perspective, not the system's.
  - ✅ `When I drag the task card to "In Progress"`
  - ❌ `When the system updates orat_tasks.status`
- Use **present tense, active voice**, first person ("I").
- Domain vocabulary follows `AGENTS.md`: **Organization**, **Project**,
  **Task**, **Board / List / Timeline**, **Owner's Rep**, **invitation**.
  Don't invent synonyms ("workspace", "ticket", "swimlane").

## Tying to beads

Every story should have a corresponding beads issue so the work is tracked:

```bash
bd create --title="<Feature title>" --type=feature \
  --description="See e2e/<name>.feature"
```

Reference the beads ID in the PR that adds the `.feature` file. If the story
has multiple scenarios that ship in different PRs, create child issues with
`bd dep add`.

## Worked example

For "let an org admin invite a teammate by email":

```gherkin
Feature: Invite a teammate to the organization

  As an organization admin
  I want to send an email invitation with a role and title
  So that my teammate can join my org and start working on projects.

  Scenario: Admin sends an invitation
    Given I am signed in as an admin of "Acme Construction"
    And I am on the organization settings page
    When I enter a teammate's email, first name, last name, and title
    And I select the "Member" role
    And I submit the invite form
    Then I see the invitation in the "Pending" list
    And I can copy the invite link

  Scenario: Invited user accepts and joins the org
    Given I have received an invitation link for "Acme Construction"
    When I open the link and sign in
    Then I am added to "Acme Construction" as a member
    And I land on the ORAT dashboard scoped to that organization

  Scenario: Non-admin cannot send invitations
    Given I am signed in as a member (not admin) of "Acme Construction"
    When I open the organization settings page
    Then I do not see the invite form
```

## Anti-patterns

- ❌ UI mechanics in steps — `When I click the button with class "btn-primary"`.
  Steps should survive a redesign.
- ❌ Implementation leakage — `Then a row is inserted into orat_tasks`.
  Stories describe **what the user experiences**, not how it's stored.
- ❌ Multiple unrelated scenarios crammed into one (`When ... And I also ...
  And then later ...`). Split them.
- ❌ Skipping the role/want/benefit narrative. It's the part that justifies
  the feature; without it, you have a test plan, not a story.
- ❌ Inventing new domain terms. Reuse the vocabulary in `AGENTS.md` and
  `src/app/orat/types.ts`.
- ❌ Writing the story as a Playwright spec directly. Stories are
  format-agnostic — `.feature` keeps them readable to non-engineers.
