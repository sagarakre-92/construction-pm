Feature: Resend my verification email

  As a new user who did not receive a verification email
  I want to request another one without re-entering my password
  So that I can finish signing up even if the first email never arrived.

  Background:
    Given I have signed up with "alex@example.com"
    And I am on the "Please verify your email" page

  Scenario: Requesting a fresh verification email
    When I click "Resend verification email"
    Then I see a confirmation that the email was resent to "alex@example.com"
    And a new verification email is delivered to "alex@example.com"

  Scenario: Resend is rate-limited to prevent abuse
    Given I have just clicked "Resend verification email" within the last minute
    When I click "Resend verification email" again
    Then I see a message telling me to wait before requesting another email
    And no second email is sent during the cooldown window

  Scenario: Already-verified accounts cannot resend
    Given my account has already been verified
    When I navigate to the verify-email page and click "Resend verification email"
    Then I see a message that my email is already verified
    And I am offered a link to log in
