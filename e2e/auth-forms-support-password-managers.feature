Feature: Sign up and log in forms work with password managers

  As a user who relies on a password manager
  I want my browser's password manager to recognise the email and password fields on auth pages
  So that it can fill them in and offer to save new passwords.

  Scenario: Sign up form is annotated for password managers
    Given I am on the sign up page
    Then the email field is recognised as an email field for autofill
    And the password field is recognised as a new password for autofill

  Scenario: Log in form is annotated for password managers
    Given I am on the log in page
    Then the email field is recognised as an email field for autofill
    And the password field is recognised as the current password for autofill

  Scenario: Password manager offers to save credentials after sign up
    Given I have a password manager active in my browser
    When I complete the sign up form with a new email and password
    And I submit the form
    Then my password manager prompts me to save the new credentials
