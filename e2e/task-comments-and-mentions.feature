Feature: Comment on tasks and @mention teammates

  As a teammate coordinating with multiple parties on a task
  I want to discuss the task in a comment thread and pull a teammate in by @mention
  So that decisions and questions live with the work instead of in scattered emails.

  Background:
    Given I am signed in to my organization
    And the task "Review shop drawings" exists in the project "Lakeside Tower"

  Scenario: Adding a comment to a task
    When I open "Review shop drawings"
    And I post the comment "Owner approved Option B at today's meeting"
    Then the comment appears in the task's comment thread
    And the comment shows my name and the time it was posted
    And the comment count on the task increments by one

  Scenario: Comments are ordered oldest to newest
    Given "Review shop drawings" already has a comment from yesterday
    When I post a new comment today
    Then the new comment appears below the older comment

  Scenario: Mentioning a teammate notifies them
    Given my teammate "Maria Chen" is a member of my organization
    When I open "Review shop drawings"
    And I type "@" and select "Maria Chen" from the suggestions
    And I post the comment "@Maria Chen can you confirm the steel callout?"
    Then "Maria Chen" is rendered as a mention chip in the comment
    And Maria receives a notification that she was mentioned on "Review shop drawings"
    And Maria's notification includes a link to the task

  Scenario: Mention suggestions are scoped to the project's team
    Given "Lakeside Tower" has internal members Maria Chen and Jordan Reyes
    And the organization also has a member Sam Patel who is not on the project
    When I type "@" in a comment on "Review shop drawings"
    Then I see "Maria Chen" and "Jordan Reyes" in the suggestions
    And I do not see "Sam Patel" in the suggestions

  Scenario: Editing my own comment
    Given I have posted a comment on "Review shop drawings"
    When I edit the comment to fix a typo
    And I save the edit
    Then the updated text is shown
    And the comment is marked as "edited"

  Scenario: Deleting my own comment
    Given I have posted a comment on "Review shop drawings"
    When I delete the comment
    Then the comment no longer appears in the thread
    And the comment count on the task decrements by one

  Scenario: Cannot edit or delete someone else's comment
    Given Maria Chen has posted a comment on "Review shop drawings"
    When I view the comment thread
    Then I do not see edit or delete controls on Maria's comment
