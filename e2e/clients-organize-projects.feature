Feature: Organize projects under clients for multi-client work

  As an owner's rep working with several owners at once
  I want to group projects under the client they belong to
  So that I can quickly answer "what is open for Acme?" across every project I run for them.

  Background:
    Given I am signed in to my organization

  Scenario: Creating a client
    Given I am on the organization settings page
    When I create a client named "Acme Properties" with a primary contact "Jordan Reyes"
    Then "Acme Properties" appears in the clients list
    And I can assign projects to "Acme Properties"

  Scenario: Assigning a project to a client at creation
    When I create a new project named "Acme HQ Renovation"
    And I select "Acme Properties" as the client
    And I save the project
    Then "Acme HQ Renovation" appears under "Acme Properties" in the projects sidebar

  Scenario: Reassigning an existing project to a different client
    Given the project "Lakeside Tower" is assigned to client "Lakeside Holdings"
    When I open the project settings for "Lakeside Tower"
    And I change the client to "Acme Properties"
    And I save the change
    Then "Lakeside Tower" appears under "Acme Properties" in the sidebar
    And "Lakeside Tower" no longer appears under "Lakeside Holdings"

  Scenario: Filtering all tasks by client
    Given I am viewing "All Projects" in the List view
    When I filter by client "Acme Properties"
    Then I see only tasks from projects assigned to "Acme Properties"
    And the filter chip "Client: Acme Properties" is visible

  Scenario: Dashboard metrics scoped by client
    When I filter by client "Acme Properties"
    Then the metric tiles show counts only for that client's tasks
    And the Overdue count reflects only that client's overdue tasks

  Scenario: Projects without a client remain accessible
    Given the project "Internal Pursuit" has no client assigned
    When I open the projects sidebar
    Then "Internal Pursuit" appears under a group labelled "No client"
