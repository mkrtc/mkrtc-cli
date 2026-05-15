# mkrtc

A small Bun-powered CLI for local terminal tooling: zsh aliases, saved UUIDs,
SSH presets, password checks, and project self-updates.

`mkrtc` stores data locally in SQLite, writes aliases back to Oh My Zsh, and now
uses a decorator-based program/provider container internally.

> **Status:** `init`, `update`, `alias`, `uuid`, `ssh`, and `bf` are available.

---

## Requirements

- [Bun](https://bun.sh) 1.3 or newer.
- zsh with [Oh My Zsh](https://ohmyz.sh/). `mkrtc` writes aliases to
  `~/.oh-my-zsh/custom/aliases.zsh`.
- `sshpass` for saving and opening password-based SSH presets.
- `gzip` for unpacking bundled password lists during `mkrtc init`.
- `git` for `mkrtc update`.
- Linux or macOS.

Only zsh is supported right now.

---

## Install

```bash
git clone https://github.com/<your-user>/mkrtc.git
cd mkrtc
bun install
./bin/install.sh
```

The installer writes a small wrapper into `~/.local/bin/` so you can call
`mkrtc` from anywhere.

You can choose a custom command name:

```bash
./bin/install.sh mk
```

To install for all users, including root, run:

```bash
./bin/install.sh --system
```

This copies the project to `/opt/mkrtc` and writes the command wrapper to
`/usr/local/bin/mkrtc`. Runtime data stays per-user in
`~/.local/share/mkrtc/db.sqlite`, so root and regular users do not share SSH
presets, UUIDs, or aliases. You can override both install paths:

```bash
./bin/install.sh --system --name mk --prefix /opt/mkrtc
```

If `~/.local/bin` is not on your `PATH`, add this to `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then initialize local assets:

```bash
mkrtc init
```

---

## Commands

```bash
mkrtc <command> [options]
```

Run `mkrtc --help` or `mkrtc <command> --help` for the exact Commander output.

| Command | Description |
|---|---|
| `init` | Prepare local assets and unpack bundled password lists |
| `update` | Pull the latest repository changes and run initialization again |
| `alias` | Manage zsh aliases and sync them to Oh My Zsh |
| `uuid` | Generate, save, read, list, and delete UUIDs |
| `ssh` | Save, list, connect to, and delete SSH presets |
| `bf` | Check a password against the bundled list and optionally brute-force it |

---

## Init — `mkrtc init`

Initializes local runtime data:

- checks whether Oh My Zsh is installed;
- offers to install Oh My Zsh if it is missing;
- unpacks bundled password archives into `static/passwords/`.

```bash
mkrtc init
```

---

## Update — `mkrtc update`

Fetches and pulls the latest code from `origin/main`, then runs the same
initialization flow used by `mkrtc init`.

```bash
mkrtc update
```

---

## Aliases — `mkrtc alias`

Manage zsh aliases. Changes are persisted to SQLite and written to
`~/.oh-my-zsh/custom/aliases.zsh`.

| Flag | Description |
|---|---|
| `-r, --read` | List stored aliases |
| `-a, --add <name=value-description>` | Add one or more aliases |
| `-d, --delete <...string>` | Delete aliases by name |
| `-s, --separator <string>` | Separator for multi-add input, default `,` |

Examples:

```bash
mkrtc alias -r
mkrtc alias -a 'gs=git status'
mkrtc alias -a 'gs=git status,gp=git pull'
mkrtc alias -d gs,gp
```

After changing aliases, reload your shell:

```bash
source ~/.zshrc
```

---

## UUIDs — `mkrtc uuid`

Generate UUIDs and optionally save them with names for later lookup.

| Flag | Description |
|---|---|
| `-g, --generate` | Generate UUIDs |
| `-s, --save` | Save generated UUIDs |
| `-l, --list` | List saved UUIDs |
| `-q, --quantity <number>` | Number of UUIDs to generate |
| `-r, --read <...string>` | Read saved UUIDs by name |
| `-d, --delete <...string>` | Delete UUIDs by name or UUID |
| `-n, --name <...string>` | Name generated UUIDs |
| `--response-format [string]` | Output format: `table`, `json`, or `string` |
| `--separator [string]` | Separator for `string` output, default `,` |

Examples:

```bash
mkrtc uuid -g
mkrtc uuid -g -q 5
mkrtc uuid -g -n session-token -s
mkrtc uuid -g -q 3 -n run -s
mkrtc uuid -l
mkrtc uuid -r session-token,run --response-format string --separator ':'
mkrtc uuid -d session-token,run_1
```

If you do not pass `--name`, the first UUID segment is used as the name.

---

## SSH — `mkrtc ssh`

Save SSH connection presets locally, list them, connect by name, and delete
saved presets.

| Flag | Description |
|---|---|
| `-s, --save` | Save an SSH preset |
| `-c, --connect` | Connect to a saved preset by name |
| `-l, --list` | List saved SSH presets |
| `-d, --delete` | Delete a saved preset; use with `--name` |
| `-n, --name <string>` | Preset name |
| `-u, --user <string>` | SSH username |
| `--ip <string>` | SSH host or IP address |
| `-p, --password <string>` | Password passed to `sshpass` |
| `-a, --args <...string>` | Extra SSH arguments to save with the preset |

Examples:

```bash
mkrtc ssh -s -n prod -u deploy --ip 192.168.1.10 -p 'secret'
mkrtc ssh -s -n prod-jump -u deploy --ip 192.168.1.10 -p 'secret' -a '-p 2222'
mkrtc ssh -l
mkrtc ssh -c -n prod
mkrtc ssh -d -n prod
```

---

## Brute Force — `mkrtc bf`

Check a password against the bundled password list and, unless
`--only-check-in-list` is used, brute-force the value using a selected charset.

Available charset tokens:

| Token | Characters |
|---|---|
| `0-9` | Digits |
| `a-z` | Lowercase English letters |
| `A-Z` | Uppercase English letters |

| Flag | Description |
|---|---|
| `-v, --value <string>` | Password/value to check |
| `-l, --len <number>` | Length to brute-force |
| `-s, --symbols <...string>` | Charset token list, default `0-9` |
| `--only-check-in-list` | Only check the bundled password list |

Examples:

```bash
mkrtc bf -v 1234 -l 4 -s 0-9
mkrtc bf -v password --only-check-in-list
mkrtc bf -v Ab9 -l 3 -s A-Z,a-z,0-9
```

The password list is unpacked by `mkrtc init` from `data/passwords/rockyou.txt.gz`
into `static/passwords/rockyou.txt`.

---

## Development Notes

The CLI is organized around decorators:

- `@Module()` registers programs and providers.
- `@Inject(key)` injects providers or other programs by key.
- `@OnInit()` marks initialization methods called after injection.
- `SystemProvider` centralizes runtime data, shell paths, sudo checks, and
  command execution.

Run locally:

```bash
bun run:dev --help
bun run:dev uuid -g
```

Type-check:

```bash
bunx tsc --noEmit
```

---

## Uninstall

```bash
rm ~/.local/bin/mkrtc
```

Your aliases stay in `~/.oh-my-zsh/custom/aliases.zsh` and keep working.

---

## License

MIT
