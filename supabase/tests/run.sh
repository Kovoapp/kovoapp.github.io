#!/usr/bin/env bash
# Corre el esquema y las pruebas de permisos contra un Postgres vacío.
# Uso: PGURL=postgres://... ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"
PSQL=(psql "$PGURL" -v ON_ERROR_STOP=1 -q -t -o /dev/null)
"${PSQL[@]}" -f auth_stub.sql
"${PSQL[@]}" -f ../schema.sql
"${PSQL[@]}" -f ../stock.sql  # correrlos encima no rompe nada
"${PSQL[@]}" -f ../alta.sql
"${PSQL[@]}" -f ../pagos.sql
"${PSQL[@]}" -f ../costos.sql
"${PSQL[@]}" -f ../pago-mes.sql
"${PSQL[@]}" -f rls_test.sql
"${PSQL[@]}" -f costos_test.sql
"${PSQL[@]}" -f pago_mes_test.sql
