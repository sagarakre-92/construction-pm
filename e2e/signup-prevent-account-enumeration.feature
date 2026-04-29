Feature: Sign up does not reveal whether an email is already registered

  As someone signing up for the application
  I want the sign up flow to look the same whether or not my email already has an account
  So that an attacker cannot harvest valid email addresses by probing the form.

  Scenario: New email address signs up successfully
    Given the email "newuser@example.com" has no account
    When I sign up with "newuser@example.com" and a valid password
    Then I am taken to the post-sign-up screen telling me to check my email

  Scenario: Existing email address sees the same screen
    Given an account already exists for "existing@example.com"
    When I sign up with "existing@example.com" and a valid password
    Then I am taken to the same post-sign-up screen telling me to check my email
    And I do not see a message that the email is already registered

  Scenario: Existing user is steered toward log in or password reset
    Given an account already exists for "existing@example.com"
    When I sign up with "existing@example.com" again
    Then the existing user receives an email explaining their account already exists
    And the email links them to log in or to reset their password
