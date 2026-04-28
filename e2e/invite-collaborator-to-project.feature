Feature: Invite a collaborator directly to one project

  As a project manager working with multiple clients
  I want to invite a collaborator to a single project with an editor or viewer role
  So that I can pull in a subcontractor for one job without exposing every other client's work.

  Background:
    Given I am signed in as an admin of "Acme Construction"
    And the organization has projects "Lakeside Tower" and "Acme HQ Renovation"

  Scenario: Sending a project-scoped invitation as an editor
    Given I am viewing the project Team view for "Lakeside Tower"
    When I open the "Invite to project" form
    And I enter email "pat@apexmep.com", first name "Pat", last name "Singh", title "MEP Lead"
    And I select the project role "Editor"
    And I submit the form
    Then I see "pat@apexmep.com" listed under the project's Pending invitations
    And the pending invitation shows the project role "Editor"
    And one invitation email is delivered to "pat@apexmep.com"

  Scenario: A project-scoped invitee can edit only the invited project
    Given Pat has accepted a project-scoped invitation as Editor of "Lakeside Tower"
    When Pat signs in
    Then Pat sees "Lakeside Tower" in the projects sidebar
    And Pat does not see "Acme HQ Renovation" in the projects sidebar
    And Pat can create, edit, and assign tasks within "Lakeside Tower"

  Scenario: A project-scoped Viewer cannot modify tasks
    Given Sam has accepted a project-scoped invitation as Viewer of "Lakeside Tower"
    When Sam signs in and opens "Lakeside Tower"
    Then Sam can read every task in the project
    But Sam does not see the "Create Task" button
    And Sam cannot drag a task between Board columns
    And Sam cannot open a task in edit mode

  Scenario: Project-scoped invitees do not see other clients' projects
    Given the organization has projects "Lakeside Tower" (client Lakeside Holdings) and "Acme HQ Renovation" (client Acme Properties)
    And Pat has accepted a project-scoped invitation as Editor of "Lakeside Tower" only
    When Pat opens the projects sidebar
    Then Pat sees only "Lakeside Tower"
    And Pat cannot reach "Acme HQ Renovation" by URL

  Scenario: Existing org admin invitation still works for org-wide access
    Given I am viewing the organization settings page
    When I fill the org-wide invite form with email "leah@example.com" and role "Admin"
    And I submit the form
    Then "leah@example.com" appears under organization-wide Pending invitations
    And once accepted, Leah can see every project in the organization

  Scenario: Promoting a project collaborator to org member
    Given Pat is an Editor on "Lakeside Tower" only
    When I send Pat an org-wide invitation as a Member
    And Pat accepts it
    Then Pat appears in the organization Members list
    And Pat sees every project in the organization
