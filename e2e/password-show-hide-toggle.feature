Feature: Show or hide my password while typing

  As a user typing a password into a sign up, log in, or password-reset form
  I want a control that lets me reveal what I have typed
  So that I can catch typos without having to retype the whole password.

  Background:
    Given I am on a page with a password field

  Scenario: Toggling the password to visible
    Given the password field is hiding what I type
    When I click the show-password control next to the field
    Then the characters I have typed are visible
    And the control changes to indicate the password is now visible

  Scenario: Toggling the password back to hidden
    Given the password field is currently visible
    When I click the hide-password control
    Then the characters are masked again
    And the control changes back to indicate the password is hidden

  Scenario: Toggling does not lose what I have typed
    Given I have typed a password into the field
    When I toggle the password to visible and back to hidden
    Then the password I typed is still in the field
