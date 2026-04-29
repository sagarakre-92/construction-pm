Feature: Clear password length requirements while signing up

  As a new user picking a password
  I want the sign up form to tell me the real minimum length up front
  So that I am not surprised by a server error after I submit.

  Scenario: The form states the minimum password length
    Given I am on the sign up page
    Then I see hint text under the password field stating "At least 8 characters"

  Scenario: A short password is rejected before submit
    Given I am on the sign up page
    When I enter an email
    And I enter a password that is 7 characters long
    And I attempt to submit the sign up form
    Then the form does not submit
    And I see a message that the password must be at least 8 characters

  Scenario: A password of the minimum length is accepted
    Given I am on the sign up page
    When I enter an email
    And I enter an 8-character password
    And I submit the sign up form
    Then the form is accepted and account creation proceeds
