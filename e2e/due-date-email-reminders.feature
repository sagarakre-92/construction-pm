Feature: Email reminders for assignments and approaching due dates

  As a teammate or external stakeholder responsible for a task
  I want to be notified by email when a task is assigned to me or about to come due
  So that I can act without having to open the app to check.

  Background:
    Given my organization uses ORAT for action tracking
    And I have a verified email address on my profile

  Scenario: Email when a task is newly assigned to me
    Given I have no open tasks assigned to me
    When a teammate creates a task titled "Coordinate concrete pour" and assigns it to me
    Then I receive an email with the subject "New task assigned: Coordinate concrete pour"
    And the email shows the project name, due date, and a link to open the task

  Scenario: Reminder three days before a task is due
    Given a task assigned to me titled "Submit permit package" is due in 3 days
    And I have not received a reminder for that task today
    When the daily reminder run completes
    Then I receive a reminder email for "Submit permit package"
    And the email shows the due date and a link to open the task

  Scenario: Daily digest of overdue tasks
    Given I have two open tasks that are overdue
    When the daily reminder run completes
    Then I receive one digest email titled "You have 2 overdue tasks"
    And the email lists each overdue task with its project and original due date
    And I do not receive separate emails for each overdue task

  Scenario: Completing a task stops further reminders
    Given a task assigned to me titled "Order long-lead steel" is overdue
    When I mark "Order long-lead steel" as Complete
    Then I do not receive further reminder emails for that task

  Scenario: External stakeholder reminders
    Given an external stakeholder named "Pat from Apex MEP" is assigned a task with an email on file
    And the task is due tomorrow
    When the daily reminder run completes
    Then Pat receives a reminder email for that task
    And the email does not expose tasks from other projects

  Scenario: Opting out of reminders
    Given I am signed in
    When I open my notification preferences
    And I turn off "Due-date reminders"
    Then I no longer receive due-date reminder emails
    And I still receive emails when a task is newly assigned to me
