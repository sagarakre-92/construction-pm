Feature: Invite teammates to the organization

  As an organization owner or admin
  I want to invite teammates by email and manage pending invitations from Organization settings
  So that the right people can join my organization without sharing passwords or manual account setup.

  Scenario: Owner sends an invitation using only an email address
    Given I am signed in as an owner of my Organization
    And I am on the Organization settings page
    When I enter a teammate's email address in the invite form
    And I submit the invite form
    Then I see a confirmation that an invitation was emailed to that address
    And I see the teammate's email in the pending invitations list

  Scenario: Organization settings shows current teammates
    Given I am signed in as an owner of my Organization
    And my Organization already has other members
    When I open the Organization settings page
    Then I see a list of current teammates with their roles

  Scenario: Admin can resend or cancel a pending invitation
    Given I am signed in as an admin of my Organization
    And a pending invitation exists for a teammate's email
    When I open the Organization settings page and cancel that pending invitation
    Then that invitation no longer appears in the pending list

  Scenario: Admin can resend a pending invitation email
    Given I am signed in as an admin of my Organization
    And a pending invitation exists for a teammate's email
    When I open the Organization settings page and choose to resend the invitation email
    Then I see confirmation that the invitation was sent again

  Scenario: Member without admin rights cannot manage invitations
    Given I am signed in as a member of my Organization without owner or admin role
    When I open the Organization settings page
    Then I do not see the invite form
    And I see messaging that only owners or admins can manage members and invitations
