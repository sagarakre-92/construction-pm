Feature: Pending invitations are visible and manageable

  As a project manager onboarding teammates
  I want to see who has been invited but not yet accepted, and resend or revoke their invitation
  So that I always know the true state of my team and can recover from a bad email or expired link.

  Background:
    Given I am signed in as an admin of "Acme Construction"
    And I am viewing the project "Lakeside Tower"

  Scenario: Pending invitations appear in the project Team view
    Given an invitation has been sent to "maria@example.com" for the organization
    When I open the project Team view for "Lakeside Tower"
    Then I see a "Pending invitations" section
    And the section lists "maria@example.com" with the role "Member" and the date the invitation was sent

  Scenario: Resending an invitation
    Given a pending invitation exists for "maria@example.com"
    When I click "Resend" on Maria's pending invitation
    Then I see a confirmation that the invitation was resent
    And Maria's pending invitation row shows an updated "last sent" timestamp

  Scenario: Revoking a pending invitation
    Given a pending invitation exists for "maria@example.com"
    When I click "Revoke" on Maria's pending invitation
    And I confirm the revocation
    Then Maria's invitation no longer appears in the Pending list
    And opening the original invite link shows that the invitation has been revoked

  Scenario: Accepted invitations leave the Pending list and join Members
    Given a pending invitation exists for "maria@example.com"
    When Maria accepts the invitation
    Then Maria appears in the project Members list
    And Maria's invitation no longer appears in the Pending list

  Scenario: Non-admins cannot manage pending invitations
    Given I am signed in as a member (not admin) of "Acme Construction"
    When I open the project Team view for "Lakeside Tower"
    Then I see the Pending invitations list
    But I do not see the "Resend" or "Revoke" controls
