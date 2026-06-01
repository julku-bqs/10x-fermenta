# Lessons

Recurring rules and patterns discovered during development. Treat as priors for future plans and reviews.

---

## Always run eslint --fix on new files after create/edit on Windows

- **Context**: Windows development — any implement phase that creates or edits files using the `create` or `edit` tools
- **Problem**: The `create` and `edit` tools write CRLF line endings on Windows regardless of `.gitattributes` eol settings, causing ESLint/Prettier failures that require extra fix-up cycles before committing
- **Rule**: After using `create` or `edit` tools on Windows, immediately run `eslint --fix` on the newly written files before running any build or lint checks — these tools produce CRLF endings that `.gitattributes` does not prevent at write time
- **Applies to**: implement

