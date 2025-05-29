# AI Constraints for TTS App

This file contains guidelines and rules for any AI or human making changes to this codebase. Please review and respect these constraints before committing changes.

## General Principles
- **Preserve Functionality:** Do not remove or alter existing features unless explicitly requested.
- **Error Logging:** Never remove error logging. Only reduce or silence non-error logs in production.
- **Security:** Never expose API keys, secrets, or sensitive data in the frontend or public code.
- **Accessibility:** Ensure all UI changes maintain or improve accessibility (a11y) standards.
- **API Contracts:** Do not break existing API contracts or change request/response shapes without clear justification and versioning.
- **Linter/Build:** Never commit code with linter or build errors. Fix all errors and warnings before pushing.
- **Non-Intrusive:** Avoid changes that would disrupt the current user experience or workflow unless specifically requested.
- **Documentation:** Document any significant changes or new features in the README or relevant files in relatively short-form.
- **Existing Code:** If any existing code violates any of these, it is acceptable to point it out, but do not change it without being explicitly told. (Unless it is objectively wrong, provably fixable, and non-intrusive to fix.)

## How to Use
- Before making changes, read and follow these constraints.
- If a change requires breaking one of these rules, document the reason in your commit message and in this file if appropriate.
- Refer to this file from the main app entry point for visibility. 