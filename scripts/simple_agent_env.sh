#!/usr/bin/env bash

simple_agent_load_env() {
  local root_dir="${1:-.}"
  local base_env="$root_dir/.env"
  local dev_env="$root_dir/.env.development"
  local prod_env="$root_dir/.env.production"
  local requested_env=""
  local env_file=""

  if [ -f "$base_env" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$base_env"
    set +a
  fi

  requested_env="${SIMPLE_AGENT_RUNTIME_ENV:-${APP_ENV:-}}"
  case "$requested_env" in
    prod|production|server|release)
      env_file="$prod_env"
      ;;
    *)
      if [ -z "$requested_env" ] && [ -f "$prod_env" ] && [ ! -f "$dev_env" ]; then
        env_file="$prod_env"
      else
        env_file="$dev_env"
      fi
      ;;
  esac

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi

  requested_env="${SIMPLE_AGENT_RUNTIME_ENV:-${APP_ENV:-}}"
  case "$requested_env" in
    prod|production|server|release)
      SIMPLE_AGENT_EFFECTIVE_ENV="production"
      ;;
    *)
      if [ "$env_file" = "$prod_env" ]; then
        SIMPLE_AGENT_EFFECTIVE_ENV="production"
      else
        SIMPLE_AGENT_EFFECTIVE_ENV="${requested_env:-development}"
      fi
      ;;
  esac

  SIMPLE_AGENT_ENV_FILE_LOADED="$env_file"
  export SIMPLE_AGENT_EFFECTIVE_ENV SIMPLE_AGENT_ENV_FILE_LOADED
}
