---
name: auto-qa-review
description: Always invoke a dedicated QA subagent to review code changes against past mistakes in SYSTEM_README_AI.md.
---

# Auto QA Review Process (Zero-Defect Policy)

You must ALWAYS invoke this skill whenever you write or modify code in this project. Never deliver code without running this QA process.

## The Process

1. **Spawn the Reviewer**: Use the define_subagent and invoke_subagent tools to create a subagent named strict_qa_reviewer.
2. **Review against the Memo**: Instruct the subagent to read C:\Users\hirok\Desktop\Claude\出品管理132\SYSTEM_README_AI.md thoroughly.
3. **Verify**: Have the subagent verify your recent code changes against all past failures and rules listed in the memo. (For example, checking for syntax errors via 
ode -c, checking if HTML cache version ?v=X was bumped, checking if Flexbox layouts have min-height: 0).
4. **Accumulate Knowledge**: If a new mistake is found during this process or by the user later, you or the subagent MUST immediately append the cause and solution to SYSTEM_README_AI.md.
5. **Escalation**: If you and the strict_qa_reviewer fail to resolve a bug after multiple iterations, you must spawn a 3rd subagent (e.g., senior_architect) to solve it.

This skill ensures that "another you" acts as a strict gatekeeper, preventing the same silly mistakes from happening twice.
