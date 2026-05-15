#!/usr/bin/env bash
set -euo pipefail

NAME="mkrtc"
MODE="user"
PREFIX="/opt/mkrtc"
ORIGINAL_ARGS=("$@")

usage() {
  cat <<'EOF'
Usage:
  ./bin/install.sh [name]
  ./bin/install.sh --name mkrtc
  ./bin/install.sh --system [--name mkrtc] [--prefix /opt/mkrtc]

Options:
  --system          Install for all users into /usr/local/bin.
  --prefix <path>   System install project directory. Default: /opt/mkrtc.
  -n, --name <name> Installed command name. Default: mkrtc.
  -h, --help        Show this help.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --system)
      MODE="system"
      shift
      ;;
    --prefix)
      PREFIX="${2:?Error: --prefix requires a path}"
      shift 2
      ;;
    -n | --name)
      NAME="${2:?Error: --name requires a command name}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Error: unknown option $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      NAME="$1"
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return
  fi

  if [ -n "${BUN_BIN:-}" ] && [ -x "$BUN_BIN" ]; then
    printf '%s\n' "$BUN_BIN"
    return
  fi

  if [ -n "${SUDO_USER:-}" ] && command -v getent >/dev/null 2>&1; then
    local sudo_home
    sudo_home="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
    if [ -x "$sudo_home/.bun/bin/bun" ]; then
      printf '%s\n' "$sudo_home/.bun/bin/bun"
      return
    fi
  fi

  if [ -x "$HOME/.bun/bin/bun" ]; then
    printf '%s\n' "$HOME/.bun/bin/bun"
    return
  fi

  return 1
}

require_bun() {
  local bun_bin
  if ! bun_bin="$(find_bun)"; then
    echo "Error: bun не установлен или не найден в PATH" >&2
    echo "" >&2
    echo "Установи одним из способов:" >&2
    echo "  curl -fsSL https://bun.sh/install | bash" >&2
    echo "  npm install -g bun" >&2
    echo "  brew install oven-sh/bun/bun     # macOS" >&2
    echo "" >&2
    echo "Для sudo/system установки можно указать путь явно:" >&2
    echo "  sudo BUN_BIN=\"$(command -v bun 2>/dev/null || echo /path/to/bun)\" ./bin/install.sh --system" >&2
    exit 1
  fi

  printf '%s\n' "$bun_bin"
}

rerun_system_install_as_root() {
  if [ "$MODE" != "system" ] || [ "${EUID:-$(id -u)}" -eq 0 ]; then
    return
  fi

  local bun_bin
  bun_bin="$(require_bun)"

  if ! command -v sudo >/dev/null 2>&1; then
    echo "Error: --system требует root-прав, а sudo не найден" >&2
    echo "Запусти от root:" >&2
    echo "  su -c './bin/install.sh --system'" >&2
    exit 1
  fi

  echo "-> --system требует root-прав, перезапускаю через sudo..."
  exec sudo BUN_BIN="$bun_bin" "$SCRIPT_DIR/install.sh" "${ORIGINAL_ARGS[@]}"
}

ensure_project() {
  local root="$1"
  local target="$root/src/index.ts"

  if [ ! -f "$target" ]; then
    echo "Error: $target не найден" >&2
    exit 1
  fi
}

install_deps() {
  local root="$1"
  local bun_bin="$2"

  if [ ! -d "$root/node_modules" ]; then
    echo "-> node_modules не найден, ставлю зависимости..."
    (cd "$root" && "$bun_bin" install)
  fi

  echo "-> применяю миграции базы данных..."
  (cd "$root" && "$bun_bin" ./src/database/migrate.ts)
}

resolve_user_db_path() {
  if [ -n "${MKRTC_DB_PATH:-}" ]; then
    printf '%s\n' "$MKRTC_DB_PATH"
    return
  fi

  if [ -n "${MKRTC_DATA_DIR:-}" ]; then
    printf '%s\n' "$MKRTC_DATA_DIR/db.sqlite"
    return
  fi

  if [ -n "${XDG_DATA_HOME:-}" ]; then
    printf '%s\n' "$XDG_DATA_HOME/mkrtc/db.sqlite"
    return
  fi

  printf '%s\n' "$HOME/.local/share/mkrtc/db.sqlite"
}

migrate_legacy_db() {
  local root="$1"
  local legacy_db="$root/db/db.sqlite"
  local user_db
  local user_db_dir

  user_db="$(resolve_user_db_path)"
  user_db_dir="$(dirname "$user_db")"

  if [ -f "$legacy_db" ] && [ ! -f "$user_db" ]; then
    echo "-> переношу legacy database в $user_db"
    mkdir -p "$user_db_dir"
    cp "$legacy_db" "$user_db"
    chmod 0600 "$user_db"
  fi
}

unpack_password_archives() {
  local root="$1"
  local source="$root/data/passwords/rockyou.txt.gz"
  local out_dir="$root/static/passwords"
  local out="$out_dir/rockyou.txt"

  if [ ! -f "$source" ] || [ -f "$out" ]; then
    return
  fi

  if ! command -v gzip >/dev/null 2>&1; then
    echo "⚠ gzip не найден, пропускаю распаковку $source" >&2
    return
  fi

  echo "-> распаковываю password list..."
  mkdir -p "$out_dir"
  gzip -dc "$source" >"$out"
  chmod 0644 "$out"
}

write_wrapper() {
  local link="$1"
  local bun_bin="$2"
  local target="$3"
  local tmp

  tmp="$(mktemp)"
  cat >"$tmp" <<EOF
#!/usr/bin/env bash
exec "$bun_bin" "$target" "\$@"
EOF
  install -m 0755 "$tmp" "$link"
  rm -f "$tmp"
}

install_user() {
  local bun_bin="$1"
  local target="$PROJECT_ROOT/src/index.ts"
  local bin_dir="$HOME/.local/bin"
  local link="$bin_dir/$NAME"

  ensure_project "$PROJECT_ROOT"
  migrate_legacy_db "$PROJECT_ROOT"
  install_deps "$PROJECT_ROOT" "$bun_bin"

  chmod +x "$target"
  mkdir -p "$bin_dir"
  write_wrapper "$link" "$bun_bin" "$target"

  echo "✓ $link -> $target"

  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *)
      echo
      echo "⚠ $bin_dir не в PATH. Добавь в ~/.bashrc или ~/.zshrc:"
      echo '  export PATH="$HOME/.local/bin:$PATH"'
      ;;
  esac
}

copy_project_for_system() {
  local install_root="$1"

  case "$install_root" in
    "" | "/" | "/usr" | "/usr/local" | "/opt")
      echo "Error: unsafe --prefix value: $install_root" >&2
      exit 1
      ;;
  esac

  mkdir -p "$install_root"
  tar \
    --exclude='./node_modules' \
    --exclude='./db/db.sqlite' \
    --exclude='./db/db.sqlite-*' \
    -C "$PROJECT_ROOT" \
    -cf - . | tar -C "$install_root" -xf -

  chown -R root:root "$install_root"
  chmod -R a+rX "$install_root"
  chmod +x "$install_root/src/index.ts"
}

install_system() {
  local bun_bin="$1"
  local install_root="$PREFIX"
  local bin_dir="/usr/local/bin"
  local link="$bin_dir/$NAME"

  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Error: --system требует root-прав" >&2
    echo "Запусти так:" >&2
    echo "  sudo ./bin/install.sh --system" >&2
    exit 1
  fi

  ensure_project "$PROJECT_ROOT"
  copy_project_for_system "$install_root"
  install_deps "$install_root" "$bun_bin"
  unpack_password_archives "$install_root"

  install -d -m 0755 "$bin_dir"
  write_wrapper "$link" "$bun_bin" "$install_root/src/index.ts"

  echo "✓ $link -> $install_root/src/index.ts"
  echo "✓ installed for all users"
}

rerun_system_install_as_root
BUN_BIN_PATH="$(require_bun)"

case "$MODE" in
  user)
    install_user "$BUN_BIN_PATH"
    ;;
  system)
    install_system "$BUN_BIN_PATH"
    ;;
esac
