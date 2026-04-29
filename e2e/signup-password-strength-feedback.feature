Feature: Get password strength feedback while signing up

  As a new user choosing a password
  I want to see how strong my password is as I type
  So that I can pick something secure without guessing what the rules are.

  Scenario: Strength indicator updates as I type
    Given I am on the sign up page
    When I type a short, common password
    Then I see a "Weak" strength indicator
    When I extend the password with mixed case, numbers, and a symbol
    Then the strength indicator moves to "Strong"

  Scenario: Strength rules are visible before I start typing
    Given I am on the sign up page and I have not typed a password yet
    Then I see the rules used to score password strength, including length and character variety

  Scenario: Submission requires the password to meet the minimum policy
    Given I am on the sign up page
    When I enter a password that does not meet the minimum strength policy
    And I submit the sign up form
    Then the form does not submit
    And I see a message explaining what the password is missing

  Scenario: A password that meets the policy is accepted
    Given I have entered a password that meets the minimum length and complexity rules
    When I submit the sign up form
    Then the form is accepted
