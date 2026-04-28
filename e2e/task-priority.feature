Feature: Prioritize tasks so the team focuses on what matters most

  As a project manager juggling many open items
  I want to mark tasks as High, Medium, or Low priority
  So that the team can immediately see which follow-ups matter most this week.

  Background:
    Given I am signed in to my organization
    And I am viewing the project "Lakeside Tower"

  Scenario: Setting a priority when creating a task
    When I create a new task with the title "Confirm crane delivery date"
    And I set the priority to "High"
    And I save the task
    Then I see "Confirm crane delivery date" in the task list
    And the task is marked with a "High" priority indicator

  Scenario: Changing the priority of an existing task
    Given the task "Review shop drawings" exists with priority "Medium"
    When I open "Review shop drawings"
    And I change the priority to "High"
    And I save the task
    Then "Review shop drawings" is marked as "High" priority

  Scenario: Priority is visible on every view
    Given the task "Confirm crane delivery date" has priority "High"
    When I switch to the Board view
    Then the "Confirm crane delivery date" card shows a "High" priority indicator
    When I switch to the List view
    Then the "Confirm crane delivery date" row shows "High" in the priority column
    When I switch to the Timeline view
    Then the "Confirm crane delivery date" bar is marked as "High" priority

  Scenario: Sorting tasks in the List view by priority
    Given the project has tasks of mixed priority
    When I view the List
    And I sort by priority
    Then High-priority tasks appear above Medium-priority tasks
    And Medium-priority tasks appear above Low-priority tasks

  Scenario: Tasks created without a priority default to Medium
    When I create a new task with the title "Schedule pre-construction meeting"
    And I save the task without setting a priority
    Then the task is created with priority "Medium"
