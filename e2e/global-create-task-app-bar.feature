# Beads: orat-5rs
Feature: Global create task from the main app bar

  As a project user
  I want the Create Task action on the main app bar with a clear Project choice
  So that I can add tasks from anywhere without hunting for a project-only button.

  Background:
    Given I am signed in to the application
    And I can access one or more Projects
    And every Task belongs to a Project

  Scenario: Create Task is not in the project task toolbar
    Given I am viewing a specific Project (not "All Projects")
    When I look at the filters and view controls above the task board or list
    Then I do not see a "Create Task" control in that project task area
    And I see "Create Task" in the main app bar to the left of Settings

  Scenario: Create Task in the app bar opens the existing create task dialog
    Given I am anywhere on the ORAT dashboard after projects have loaded
    When I choose "Create Task" from the main app bar
    Then I see the "Create Task" dialog
    And the dialog includes a Project field for new tasks

  Scenario: Project is prepopulated when I start from a project page
    Given I am viewing a specific Project
    When I choose "Create Task" from the main app bar
    Then the Project field shows the Project I am viewing
    And I can still change the Project to another one I have access to

  Scenario: Project is empty by default when I start from All Projects
    Given I am viewing "All Projects"
    When I choose "Create Task" from the main app bar
    Then the Project field does not default to a specific Project
    And I can choose from the Projects I have access to

  Scenario: I must select a Project before a new task can be saved from All Projects
    Given I am viewing "All Projects"
    And I have opened "Create Task" from the main app bar
    And I have not selected a Project
    Then I cannot save the new task until I choose a Project
    And no new task is created for any Project until I save successfully
