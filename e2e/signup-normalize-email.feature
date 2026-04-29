Feature: Sign up treats my email address as case-insensitive

  As a new user signing up
  I want capitalisation and stray spaces in my email to be ignored
  So that I do not end up with a duplicate account or a login I cannot use.

  Scenario: Email with uppercase letters is normalized
    Given I am on the sign up page
    When I sign up with email "Foo@Example.com" and a valid password
    Then my account is created for "foo@example.com"
    And I can subsequently log in using either "Foo@Example.com" or "foo@example.com"

  Scenario: Trailing whitespace in email is trimmed
    Given I am on the sign up page
    When I sign up with email " bar@example.com " and a valid password
    Then my account is created for "bar@example.com"
    And I can log in with "bar@example.com"

  Scenario: Mixed-case duplicate is treated as the existing account
    Given an account already exists for "carol@example.com"
    When I attempt to sign up with "CAROL@example.com"
    Then the sign up flow behaves as it does for any already-registered email
    And no second account is created
