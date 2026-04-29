Feature: Confirm my password while signing up

  As a new user creating an account
  I want to enter my chosen password twice
  So that a typo cannot lock me out of an account I just created.

  Scenario: Submitting matching passwords creates the account
    Given I am on the sign up page
    When I enter my email
    And I enter the same password in the "Password" and "Confirm password" fields
    And I submit the sign up form
    Then my account is created
    And I am taken to the next step in the sign up flow

  Scenario: Mismatched passwords prevent submission
    Given I am on the sign up page
    When I enter my email
    And I enter different values in the "Password" and "Confirm password" fields
    Then I see a "Passwords do not match" message
    And the sign up form does not submit

  Scenario: Confirmation matches after correcting a typo
    Given I am on the sign up page and the two password fields do not match
    When I edit the "Confirm password" field so it matches the "Password" field
    Then the "Passwords do not match" message goes away
    And I can submit the sign up form
