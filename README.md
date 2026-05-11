# mkrtc

A small, opinionated CLI for the things you keep re-typing into your terminal — **zsh aliases**, **UUIDs**, and **SSH connections** — stored locally and synced into your shell config so they just work in every new terminal.

> **Status:** the `alias`, `uuid`, and `ssh` commands are ready to use.

---

## Requirements

- [**Bun**](https://bun.sh) ≥ 1.3 — install with:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **zsh** with [**Oh My Zsh**](https://ohmyz.sh/) — `mkrtc` writes your aliases to `~/.oh-my-zsh/custom/aliases.zsh`. If Oh My Zsh isn't installed, `mkrtc init` will offer to install it.
- **sshpass** — required by `mkrtc ssh` when saving and opening SSH connections.
- Linux or macOS.

> Only `zsh` is supported right now. Bash support is on the roadmap.

---

## Install

```bash
git clone https://github.com/<your-user>/mkrtc.git
cd mkrtc
./bin/install.sh
```

That's it. The installer symlinks `mkrtc` into `~/.local/bin/` so you can call it from anywhere.

You can pick a custom command name as the first argument:

```bash
./bin/install.sh mk      # call it as `mk` instead of `mkrtc`
```

If `~/.local/bin` is not on your `PATH`, add this to `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then initialize:

```bash
mkrtc init
```

This sets up the local database and imports any aliases you already have in `~/.oh-my-zsh/custom/aliases.zsh`.

---

## Usage

```
mkrtc <command> [options]
```

Run `mkrtc --help` to see all commands.

---

### Aliases — `mkrtc alias`

Manage your zsh aliases. Every change is written straight to `~/.oh-my-zsh/custom/aliases.zsh`, so they survive across new terminals.

| Flag | Description |
|---|---|
| `-r, --read` | List all stored aliases as a table |
| `-a, --add <name=value-description>` | Add one or more aliases (comma-separated) |
| `-d, --delete <names>` | Delete aliases by name (comma-separated) |

**Examples**

```bash
# List everything
mkrtc alias -r

# Add a single alias
mkrtc alias -a 'gs=git status'

# Add an alias with a description
mkrtc alias -a 'gs=git status - show working tree status'

# Add several at once
mkrtc alias -a 'gs=git status,gp=git pull,gc=git commit'

# Delete one or more
mkrtc alias -d gs,gp
```

After any change, reload your shell to pick up the new aliases:

```bash
source ~/.zshrc
```

(Or just open a new terminal.)

---

### UUIDs — `mkrtc uuid`

Generate UUIDs on demand, and optionally save them with a name so you can recall them later.

| Flag | Description |
|---|---|
| `-g, --generate` | Generate a new UUID |
| `-q, --quantity <n>` | How many to generate (default `1`) |
| `-n, --name <names>` | Optional name(s), comma-separated |
| `-s, --save` | Persist the generated UUID(s) |
| `-l, --list` | List all saved UUIDs |
| `-r, --read <names>` | Look up saved UUIDs by name (comma-separated) |
| `-d, --delete <names>` | Delete saved UUIDs by name (comma-separated) |

**Examples**

```bash
# Quick one-off UUID
mkrtc uuid -g

# Five at once
mkrtc uuid -g -q 5

# Generate and save with a name
mkrtc uuid -g -n session-token -s

# Generate three with the same base name (auto-suffixed: run, run_1, run_2)
mkrtc uuid -g -q 3 -n run -s

# List everything you've saved
mkrtc uuid -l

# Recall by name
mkrtc uuid -r session-token,run

# Delete by name
mkrtc uuid -d session-token,run_1
```

If you don't pass `--name`, the first segment of the UUID is used as its name.

---

### SSH — `mkrtc ssh`

Save SSH connection presets locally, list them, connect by name, and delete saved presets.

`mkrtc ssh` uses `sshpass` under the hood and opens the SSH process in your current terminal.

| Flag | Description |
|---|---|
| `-s, --save` | Save a new SSH connection preset |
| `-c, --connect` | Connect to a saved preset by name |
| `-l, --list` | List saved SSH presets as a table |
| `-d, --delete` | Delete a saved SSH preset; use with `--name` |
| `-n, --name <name>` | Preset name |
| `-u, --user <username>` | SSH username |
| `--ip <host>` | SSH host or IP address |
| `-p, --password <password>` | SSH password passed to `sshpass` |
| `-a, --args <args>` | Extra SSH arguments to save with the preset; comma-separated values are supported |

**Examples**

```bash
# Save a connection
mkrtc ssh -s -n prod -u deploy --ip 192.168.1.10 -p 'secret'

# Save with extra SSH options
mkrtc ssh -s -n prod-jump -u deploy --ip 192.168.1.10 -p 'secret' -a '-p,2222'

# List saved connections
mkrtc ssh -l

# Connect by saved name
mkrtc ssh -c -n prod

# Delete by saved name
mkrtc ssh -d -n prod
```

---

## Updating

Pull the latest changes and re-run the installer (it's safe to run multiple times):

```bash
cd path/to/mkrtc
git pull
./bin/install.sh
```

## Uninstall

```bash
rm ~/.local/bin/mkrtc
```

Your aliases stay in `~/.oh-my-zsh/custom/aliases.zsh` and will keep working — `mkrtc` just stops managing them.

---

## License

MIT
