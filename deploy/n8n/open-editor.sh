#!/usr/bin/env bash
set -Eeuo pipefail
# Keep this command running while using the private editor.
exec ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
  -o IdentitiesOnly=yes -i "${WAKA_SSH_KEY:-$HOME/.ssh/aws_rsa}" \
  -L 127.0.0.1:5678:127.0.0.1:5678 ec2-user@44.210.143.148
