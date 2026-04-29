Feature: Reset a forgotten password by email

  As a returning user who has forgotten my password
  I want to request a reset link by email and choose a new password
  So that I can regain access to my account without contacting support.

  Scenario: Requesting a reset link from the log in page
    Given I am on the log in page
    When I click "Forgot password?"
    And I enter my registered email address
    And I submit the request
    Then I see a confirmation that a reset link has been sent if an account exists for that email
    And a reset email is delivered to my inbox

  Scenario: Unknown email does not reveal whether an account exists
    Given I am on the forgot-password page
    When I submit a reset request for an email with no account
    Then I see the same confirmation message as for a registered email
    And no email is sent

  Scenario: Following the reset link lets me set a new password
    Given I have received a password reset email
    When I click the reset link
    Then I am taken to a page where I can enter and confirm a new password
    When I enter a new password, confirm it, and submit
    Then I see a confirmation that my password has been updated
    And I can log in with the new password

  Scenario: Expired or used reset link shows a clear error
    Given I have a reset link that has expired or already been used
    When I open the link
    Then I see an explanation that the link is no longer valid
    And I am offered a way to request a new reset link
