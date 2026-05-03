Feature: Join an organization via invitation link

  As a teammate invited to an Organization by email
  I want to open my invitation link, sign in or sign up as needed, and confirm joining the Organization
  So that I land in the app with access to my team without creating a separate Organization by mistake.

  Scenario: Existing user follows the link and accepts the invitation
    Given I have an account and I received an invitation email for my Organization
    And I am signed out
    When I open the invitation link from the email
    Then I am asked to sign in and returned to the invitation after I authenticate
    When I review the invitation details and confirm that I want to join
    Then I am added to the inviting Organization
    And I am taken into the ORAT app for that Organization

  Scenario: Invited user appears in the organization's teammate list after joining
    Given I accepted an invitation to join an Organization
    When an owner opens the Organization settings page
    Then they see me listed among the Organization's teammates

  Scenario: New user completes signup from the invitation without a forced new Organization step
    Given I do not yet have an account
    And I received an invitation email to my email address
    When I open the invitation link, create an account, and complete email verification while staying in the invitation flow
    Then I am not asked to create a new Organization solely to enter the app

  Scenario: New user confirms join after signing up from the invitation
    Given I have finished sign up and email verification from my invitation link
    When I confirm joining from the invitation
    Then I am a member of the Organization I was invited to

  Scenario: Signed-in user sees a clear message when the invite was sent to a different email
    Given I am signed in with an email that does not match the invited address
    When I open someone else's invitation link
    Then I see that this invitation was sent to another email address
    And I am not added to the Organization until I use the matching account

  Scenario: User sees a clear message when the invitation is no longer valid
    Given I have an invitation link that has expired or been cancelled
    When I open the link after signing in if required
    Then I see a message that the invitation is no longer valid
    And I can navigate back to the app or sign in without being silently added to an Organization
