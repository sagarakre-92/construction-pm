Feature: Group tasks in the List view to run weekly reviews

  As an owner's rep running a weekly status meeting
  I want to group the task list by status, assignee, project, or due-date bucket
  So that I can walk through the right slice of work without scrolling a flat table.

  Background:
    Given I am signed in to my organization
    And I am viewing "All Projects" in the List view

  Scenario: Grouping by assignee for accountability review
    When I group the list by "Assignee"
    Then tasks are organised under collapsible headers, one per assignee
    And each header shows the assignee's name and the number of tasks below it
    And tasks with no assignee appear under an "Unassigned" group

  Scenario: Grouping by project for cross-project status review
    When I group the list by "Project"
    Then tasks are organised under collapsible headers, one per project
    And each header shows the project name and the number of tasks below it

  Scenario: Grouping by due-date bucket for follow-up triage
    When I group the list by "Due date"
    Then I see groups labelled "Overdue", "Due today", "This week", "Next week", and "Later"
    And tasks appear under the group that matches their current due date
    And the "Overdue" group is expanded by default

  Scenario: Collapsing a group hides its tasks
    Given the list is grouped by "Assignee"
    When I collapse the group for "Maria Chen"
    Then the tasks assigned to Maria Chen are hidden
    And the header still shows the count of hidden tasks

  Scenario: Switching off grouping returns to the flat sortable list
    Given the list is grouped by "Project"
    When I set grouping to "None"
    Then the list shows every task in a single sortable table
    And my previous sort order is preserved

  Scenario: Group choice persists when I leave and return
    Given I have grouped the list by "Due date"
    When I navigate away to the Board view and return to the List view
    Then the list is still grouped by "Due date"
