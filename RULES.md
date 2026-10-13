# Development Rules

## JavaScript

- Use modern JavaScript
- Prefer const and let
- Avoid var
- Use async/await
- Keep functions small
- Use meaningful names
- Avoid unnecessary abstractions

## Architecture

- Keep business logic outside UI code
- UI should not calculate assignment scores
- Assignment logic belongs in assignmentService.js
- Keep modules independent
- Avoid global state where possible

## Error Handling

- Validate user input
- Never silently swallow errors
- Show user-friendly error messages
- Log technical errors for debugging

## Data

Order must contain:

- id
- customerName
- customerPhone
- location
- priority
- status
- assignedAgentId

Agent must contain:

- id
- name
- phone
- location
- availability
- activeOrders

## AI Rules

AI may:

- Suggest code
- Explain code
- Generate tests
- Suggest refactoring

AI must not:

- Change architecture without approval
- Add libraries without approval
- Introduce unnecessary frameworks
- Add authentication/security mechanisms without explanation
- Rewrite working code unnecessarily