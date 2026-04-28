Feature: An invitee lands on the project they were invited to

  As someone who just accepted an invitation
  I want the app to take me directly to the project I was invited to
  So that I start collaborating without having to hunt for it in the sidebar.

  Background:
    Given the organization "Acme Construction" exists
    And it has projects "Lakeside Tower" and "Acme HQ Renovation"

  Scenario: Project-scoped invitee lands on the invited project
    Given I have received a project-scoped invitation as Editor of "Lakeside Tower"
    When I open the invitation link and sign in
    Then I am redirected into the dashboard with "Lakeside Tower" already selected
    And I see a welcome message that mentions "Lakeside Tower"
    And the Board view shows the tasks for "Lakeside Tower"

  Scenario: Org-wide invitee lands on the dashboard with no project selected
    Given I have received an organization-wide invitation as Member of "Acme Construction"
    When I open the invitation link and sign in
    Then I am redirected to the dashboard for "Acme Construction"
    And no specific project is selected
    And I see a welcome message that mentions "Acme Construction"

  Scenario: Already-signed-in user accepts via the link
    Given I am already signed in to a different organization
    When I open a project-scoped invitation link for "Lakeside Tower"
    And I confirm that I want to accept the invitation
    Then I am taken to the dashboard for "Acme Construction"
    And "Lakeside Tower" is already selected

  Scenario: Expired or revoked invitation
    Given I have an invitation link for "Lakeside Tower" that has been revoked
    When I open the link
    Then I see a clear message that the invitation is no longer valid
    And I am not redirected to any project
