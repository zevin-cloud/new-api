#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
api_port=${DEV_API_PORT:-3000}
classic_port=${DEV_WEB_CLASSIC_PORT:-5174}
runtime_dir=""
backend_pid=""
frontend_pid=""

cleanup() {
	trap - EXIT INT TERM
	if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
		kill "$frontend_pid" 2>/dev/null || true
	fi
	if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
		kill "$backend_pid" 2>/dev/null || true
	fi
	if [ -n "$frontend_pid" ]; then
		wait "$frontend_pid" 2>/dev/null || true
	fi
	if [ -n "$backend_pid" ]; then
		wait "$backend_pid" 2>/dev/null || true
	fi
	if [ -n "$runtime_dir" ] && [ -d "$runtime_dir" ]; then
		rm -rf -- "$runtime_dir"
	fi
}

trap cleanup EXIT
trap 'exit 0' INT TERM

for command_name in go bun; do
	if ! command -v "$command_name" >/dev/null 2>&1; then
		echo "Missing required command: $command_name" >&2
		exit 1
	fi
done

if command -v lsof >/dev/null 2>&1; then
	if lsof -nP -iTCP:"$api_port" -sTCP:LISTEN >/dev/null 2>&1; then
		echo "Port $api_port is already in use. Stop the existing backend first." >&2
		exit 1
	fi
	if lsof -nP -iTCP:"$classic_port" -sTCP:LISTEN >/dev/null 2>&1; then
		echo "Port $classic_port is already in use. Stop the existing frontend first." >&2
		exit 1
	fi
fi

if [ ! -f "$project_dir/web/default/dist/index.html" ]; then
	echo "Preparing embedded default frontend assets..."
	(
		cd "$project_dir/web"
		bun install
		cd default
		DISABLE_ESLINT_PLUGIN=true \
			VITE_REACT_APP_VERSION=$(tr -d '\n' < "$project_dir/VERSION") \
			bun run build
	)
fi

if [ ! -x "$project_dir/web/node_modules/.bin/rsbuild" ]; then
	echo "Installing classic frontend dependencies..."
	(
		cd "$project_dir/web"
		bun install --filter ./classic
	)
fi

if [ ! -f "$project_dir/web/classic/dist/index.html" ]; then
	echo "Preparing embedded classic frontend assets..."
	(
		cd "$project_dir/web/classic"
		VITE_REACT_APP_VERSION=$(tr -d '\n' < "$project_dir/VERSION") bun run build
	)
fi

runtime_dir=$(mktemp -d "${TMPDIR:-/tmp}/new-api-dev.XXXXXX")

echo "Building Go backend..."
(
	cd "$project_dir"
	go build -o "$runtime_dir/new-api" .
)

echo "Starting backend: http://localhost:$api_port"
(
	cd "$project_dir"
	PORT="$api_port" "$runtime_dir/new-api"
) &
backend_pid=$!

echo "Starting classic frontend: http://localhost:$classic_port"
(
	cd "$project_dir/web/classic"
	bun run dev -- --host 0.0.0.0 --port "$classic_port"
) &
frontend_pid=$!

echo "Press Ctrl+C to stop both services."

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
	sleep 1
done

echo "A development service stopped unexpectedly." >&2
exit 1
