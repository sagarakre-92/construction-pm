Feature: Save and share filtered task views

  As an owner's rep who reviews the same slices of work every week
  I want to save my current filters as a named view and share it with teammates
  So that recurring status conversations open to the right tasks without setup.

  Background:
    Given I am signed in to my organization
    And I am viewing "All Projects" in the List view

  Scenario: Saving the current filters as a named view
    Given I have filtered to "My tasks" with priority "High" and due date "This week"
    When I save the current view as "My week — high priority"
    Then "My week — high priority" appears in my list of saved views
    And the view captures the current filters and the active grouping

  Scenario: Reopening a saved view restores its filters
    Given I have a saved view named "Lakeside — overdue"
    When I open the saved view "Lakeside — overdue"
    Then the page applies the project filter "Lakeside Tower"
    And the page applies the status filter "Overdue"
    And the matching tasks are listed

  Scenario: Sharing a saved view with a teammate
    Given I have a saved view named "Acme weekly review"
    When I copy the share link for "Acme weekly review"
    And my teammate Maria opens the link while signed in to the same organization
    Then Maria sees the same filters applied
    And Maria sees the same tasks I see, scoped by her own permissions

  Scenario: Updating a saved view after changing filters
    Given I have opened the saved view "My week — high priority"
    When I change the priority filter to "High or Medium"
    And I update the saved view
    Then the next time I open "My week — high priority" the priority filter is "High or Medium"

  Scenario: Deleting a saved view
    Given I have a saved view named "Old triage"
    When I delete the saved view "Old triage"
    Then "Old triage" no longer appears in my list of saved views
    And other teammates' saved views are unaffected
