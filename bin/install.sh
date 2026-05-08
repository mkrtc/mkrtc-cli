#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-mkrtc}"

# Где лежит сам install.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Корень проекта — на уровень выше
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$PROJECT_ROOT/src/index.ts"

BIN_DIR="$HOME/.local/bin"
LINK="$BIN_DIR/$NAME"

# 1. Bun установлен?
if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun не установлен" >&2
  echo "" >&2
  echo "Установи одним из способов:" >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  echo "  npm install -g bun" >&2
  echo "  brew install oven-sh/bun/bun     # macOS" >&2
  echo "" >&2
  echo "Подробнее: https://bun.sh/docs/installation" >&2
  exit 1
fi

# 2. index.ts на месте?
if [ ! -f "$TARGET" ]; then
  echo "Error: $TARGET не найден" >&2
  exit 1
fi

# 3. Зависимости установлены?
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "→ node_modules не найден, ставлю зависимости..."
  (cd "$PROJECT_ROOT" && bun install)
fi

# 4. Симлинк
chmod +x "$TARGET"
mkdir -p "$BIN_DIR"
ln -sfn "$TARGET" "$LINK"

echo "✓ $LINK → $TARGET"

# 5. PATH
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "⚠ $BIN_DIR не в PATH. Добавь в ~/.bashrc или ~/.zshrc:"
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    ;;
esac