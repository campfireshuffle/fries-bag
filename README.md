# fries-bag 🍟

Your agent paused its goal and wrote three paragraphs about why. Not today.

`/fries-bag <prompt>` sends `<prompt>`, and every time the agent stops, sends it again. Forever. Put the fries in the bag.

`/fries-bag stop` or Esc when the bag is full.

## Install

**Claude Code**

```
/plugin install fries-bag --marketplace campfireshuffle/fries-bag
```

**Codex** (no custom slash commands, so it's `$fries-bag <prompt>`; approve the hooks in `/hooks` once)

```
codex plugin marketplace add campfireshuffle/fries-bag
codex plugin add fries-bag@fries-bag
```

**opencode** (v2)

```
opencode plugin add 'github:campfireshuffle/fries-bag#main::path:opencode'
```

**Pi**

```
pi install git:github.com/campfireshuffle/fries-bag
```

Needs `python3` for Claude Code and Codex. Burns tokens forever, by design. MIT.
