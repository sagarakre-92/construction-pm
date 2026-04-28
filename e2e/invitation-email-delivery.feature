Feature: Invitation emails are delivered automatically

  As an organization admin inviting teammates
  I want the invitation to be emailed to the recipient as soon as I send it
  So that I do not have to copy a link and chase them on Slack or email myself.

  Background:
    Given I am signed in as an admin of the organization "Acme Construction"
    And the organization has an email provider configured

  Scenario: Sending an invitation triggers an email
    Given I am on the organization settings page
    When I fill in the invite form with email "maria@example.com", first name "Maria", last name "Chen", title "Project Engineer", and role "Member"
    And I submit the invite form
    Then I see a confirmation that the invitation was sent to "maria@example.com"
    And one email is delivered to "maria@example.com"
    And the email subject mentions "Acme Construction"
    And the email body contains a link that opens "/invite/<token>"

  Scenario: The invite link in the email accepts the invitation
    Given I have sent an invitation to "maria@example.com"
    When Maria opens the link in the email and signs in
    Then Maria is added to "Acme Construction" as a member
    And Maria sees the ORAT dashboard for that organization

  Scenario: Email delivery failure surfaces a clear error
    Given the email provider is misconfigured
    When I submit the invite form for "maria@example.com"
    Then I see an error message that the invitation could not be emailed
    And no pending invitation is created for "maria@example.com"

  Scenario: Resending an invitation re-delivers the email
    Given I have already invited "maria@example.com" and the invitation is pending
    When I click "Resend" on the pending invitation
    Then a new email is delivered to "maria@example.com"
    And the same invite link is included in the email
