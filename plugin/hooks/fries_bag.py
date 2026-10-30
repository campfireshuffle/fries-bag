#!/usr/bin/env python3
"""fries-bag hook: re-send a prompt every time the agent stops.

Claude Code and Codex share the hook protocol, so one script serves both:
- UserPromptSubmit: `/fries-bag <prompt>` (Claude Code) or `$fries-bag <prompt>`
  (Codex, which has no custom slash commands) records <prompt> for the session;
  `/fries-bag stop` or `$fries-bag stop` clears it.
- Stop: if the session has a recorded prompt, block stopping and feed it back.
- Interrupt (Codex only): Esc clears the loop.
"""

import json
import os
import re
import sys
from pathlib import Path

COMMAND = re.compile(r"^\s*[/$](?:fries-bag:)?fries-bag(?:\s+(.*))?$", re.DOTALL)


def state_file(session_id: str) -> Path:
    root = os.environ.get("FRIES_BAG_STATE_DIR") or Path.home() / ".fries-bag"
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id)
    return Path(root) / safe


def main() -> None:
    event = json.load(sys.stdin)
    session_id = event.get("session_id") or ""
    if not session_id:
        return
    state = state_file(session_id)

    if event.get("hook_event_name") == "UserPromptSubmit":
        match = COMMAND.match(event.get("prompt") or "")
        if not match:
            return
        prompt = (match.group(1) or "").strip()
        if prompt in ("", "stop"):
            state.unlink(missing_ok=True)
            print(json.dumps({"decision": "block", "reason": "fries-bag stopped."}))
            return
        state.parent.mkdir(parents=True, exist_ok=True)
        state.write_text(prompt)
        return

    if event.get("hook_event_name") == "Stop":
        # Codex treats a Stop hook's empty or non-JSON stdout as invalid.
        decision = {"decision": "block", "reason": state.read_text()} if state.exists() else {}
        print(json.dumps(decision))
        return

    if event.get("hook_event_name") == "Interrupt":
        state.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
