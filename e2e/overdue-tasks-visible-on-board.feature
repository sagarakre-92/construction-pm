Feature: Overdue tasks are visible on the Board

  As an owner's rep coordinating multiple parties
  I want overdue tasks to remain visible on the Board view
  So that the team's most urgent follow-ups are never hidden by the workflow.

  Background:
    Given I am signed in to my organization
    And the project "Lakeside Tower" has these tasks:
      | title                  | status      | due date    |
      | Submit permit package  | In Progress | yesterday   |
      | Order long-lead steel  | Not Started | last week   |
      | Review shop drawings   | In Progress | next week   |
      | Final inspection sign  | Complete    | last month  |

  Scenario: Overdue tasks appear in a dedicated Overdue lane
    Given I am viewing the Board for "Lakeside Tower"
    Then I see a column labelled "Overdue" before "Not Started"
    And the "Overdue" column contains "Submit permit package" and "Order long-lead steel"
    And those cards are visually marked as overdue

  Scenario: Completed tasks never appear as overdue
    Given I am viewing the Board for "Lakeside Tower"
    Then "Final inspection sign" appears in the "Complete" column
    And "Final inspection sign" does not appear in the "Overdue" column

  Scenario: Resolving an overdue task by extending the due date
    Given I am viewing the Board for "Lakeside Tower"
    And "Submit permit package" appears in the "Overdue" column
    When I open "Submit permit package" and change the due date to next Friday
    Then "Submit permit package" appears in the "In Progress" column
    And it is no longer marked as overdue

  Scenario: Completing an overdue task removes it from the Overdue lane
    Given I am viewing the Board for "Lakeside Tower"
    And "Order long-lead steel" appears in the "Overdue" column
    When I drag "Order long-lead steel" to the "Complete" column
    Then "Order long-lead steel" appears in the "Complete" column
    And the "Overdue" column no longer contains "Order long-lead steel"
