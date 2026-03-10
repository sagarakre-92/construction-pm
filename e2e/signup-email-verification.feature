Feature: Sign up with email verification

  As a new user signing up for the application
  I want to sign up with my email and password and verify my email via a link
  So that I can securely access my account after confirming my address.

  Scenario: New user signs up and verifies email
    Given I am on the sign up page
    When I enter my email address
    And I enter a password
    And I submit the sign up form
    Then I am shown a page that says "Please verify your email" or similar
    And a confirmation email is sent to my email address

  Scenario: User confirms email and is prompted to log in
    Given I have signed up and received a confirmation email
    When I click the confirmation link in the email
    Then I am redirected back to the application
    And I am prompted to enter my email and password to log in
    When I enter my email and password and submit
    Then I am logged in and see the application (e.g. dashboard)
