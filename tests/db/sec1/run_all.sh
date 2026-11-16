#!/bin/bash
# Rebuilds every test database from scratch and runs the SEC-1 tests. Output: out_<db>.txt
cd /home/claude/fh/sec1
./mk.sh base_prod    prod_like.sql                                          >/dev/null
./mk.sh patched_prod prod_like.sql step12-sec1-fix.sql                      >/dev/null
./mk.sh base_s11     prod_like.sql ../work/database/step11-bank-payments.sql                                       >/dev/null
./mk.sh patched_s11  prod_like.sql step12-sec1-fix.sql step11-bank-payments.sql >/dev/null
python3 sec1_test.py base_prod              > out_base_prod.txt 2>&1
python3 sec1_test.py patched_prod           > out_patched_prod.txt 2>&1
python3 sec1_test.py base_s11 --billing     > out_base_s11.txt 2>&1
python3 sec1_test.py patched_s11 --billing  > out_patched_s11.txt 2>&1
for f in out_base_prod out_patched_prod out_base_s11 out_patched_s11; do tail -1 $f.txt; done
