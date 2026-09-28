#!/bin/bash
# 思维导图服务冒烟测试（多用户 / 空间隔离版）
# 用法：MM_BASE=http://127.0.0.1:8130 bash smoke-test.sh
# 会在目标服务里新建两个测试空间（名字带时间戳）；跑完测试脚本自己不会删，去 spaces/ 下清即可
B="${MM_BASE:-http://127.0.0.1:8099}"
SUF=$(date +%H%M%S)
A="测试A$SUF"; C="测试B$SUF"; D="限速$SUF"
JA=/tmp/mm-ja.txt; JB=/tmp/mm-jb.txt; JC=/tmp/mm-jc.txt
rm -f "$JA" "$JB" "$JC"
PASS=0; FAIL=0
ck(){ # ck "期望" "实际" "说明"
  if [ "$1" = "$2" ]; then echo "  ✅ $3"; PASS=$((PASS+1)); else echo "  ❌ $3（期望 $1 实际 $2）"; FAIL=$((FAIL+1)); fi
}
code(){ curl -s -m 6 -o /tmp/mm-out.txt -w "%{http_code}" "$@"; }
J(){ curl -s -m 6 -c "$1" -X POST "$B/api/space" -H 'Content-Type: application/json' -d "$2"; }
MAP='{"v":2,"name":null,"dirty":false,"savedAt":1,"view":{"x":0,"y":0,"s":1},"nodes":[{"id":"n1","text":"隔离测试根","parent":null,"x":0,"y":0},{"id":"n2","text":"子","parent":"n1","depth":1,"x":9,"y":9}]}'

echo "== 1. 未进入空间 =="
ck 401 "$(code $B/api/files)"                       "未带身份读文件列表被拒（401）"
ck 401 "$(code $B/api/draft)"                       "未带身份读草稿被拒（401）"
ck 401 "$(code $B/api/history?name=x)"              "未带身份读历史被拒（401）"
ck 404 "$(code $B/spaces/index.json)"               "空间索引不可被直接下载（404）"
ck 404 "$(code $B/map-data.json)"                   "旧数据文件不可被直接下载（404）"
ck 200 "$(code $B/)"                                "首页仍可访问"

echo "== 2. 建空间 A =="
ck 400 "$(code -X POST $B/api/space -H 'Content-Type: application/json' -d '{"name":"x","pin":"1"}')" "弱口令被拒（400）"
R=$(J "$JA" "{\"name\":\"$A\",\"pin\":\"1234\"}"); echo "  · $R"
echo "$R" | grep -q '"created":true' && { echo "  ✅ A 空间创建成功"; PASS=$((PASS+1)); } || { echo "  ❌ A 空间创建失败"; FAIL=$((FAIL+1)); }
curl -s -m 6 -b "$JA" $B/api/space | grep -q "\"name\":\"$A\"" && { echo "  ✅ 带 cookie 能读到自己的空间名"; PASS=$((PASS+1)); } || { echo "  ❌ 带 cookie 读不到空间名"; FAIL=$((FAIL+1)); }

echo "== 3. A 存图 / 历史 =="
ck 200 "$(code -b "$JA" -X POST "$B/api/file?name=%E9%9A%94%E7%A6%BB" -d "$MAP")" "A 保存成功"
ck 200 "$(code -b "$JA" $B/api/files)" "A 能列自己的文件"
curl -s -m 6 -b "$JA" $B/api/files | grep -q '隔离测试根' && { echo "  ✅ A 列表里有自己的图"; PASS=$((PASS+1)); } || { echo "  ❌ A 列表里没有自己的图"; FAIL=$((FAIL+1)); }
ck 200 "$(code -b "$JA" -X POST "$B/api/snapshot?name=%E9%9A%94%E7%A6%BB" -d "$MAP")" "A 存快照"
curl -s -m 6 -b "$JA" "$B/api/history?name=%E9%9A%94%E7%A6%BB" | grep -q '"items":\[{' && { echo "  ✅ A 有历史版本"; PASS=$((PASS+1)); } || { echo "  ❌ A 没有历史版本"; FAIL=$((FAIL+1)); }

echo "== 4. 建空间 B，验证隔离 =="
J "$JB" "{\"name\":\"$C\",\"pin\":\"5678\"}" > /dev/null
ck 401 "$(code $B/api/files)" "B 之外（无身份）看不到任何东西（401）"
echo "$(curl -s -m 6 -b "$JB" $B/api/files)" | grep -q '"files":\[\]' && { echo "  ✅ B 的文件列表是空的（看不到 A 的图）"; PASS=$((PASS+1)); } || { echo "  ❌ B 看到了别人的文件"; FAIL=$((FAIL+1)); }
ck 404 "$(code -b "$JB" "$B/api/file?name=%E9%9A%94%E7%A6%BB")" "B 直接按名字读 A 的图 → 404"
ck 200 "$(code -b "$JB" "$B/api/history?name=%E9%9A%94%E7%A6%BB")" "B 查同名历史 → 空（不报错也不泄露）"
curl -s -m 6 -b "$JB" "$B/api/history?name=%E9%9A%94%E7%A6%BB" | grep -q '"items":\[\]' && { echo "  ✅ B 的同名历史确实是空的"; PASS=$((PASS+1)); } || { echo "  ❌ B 读到了 A 的历史"; FAIL=$((FAIL+1)); }

echo "== 5. 重名进入 / 错口令 / 限速 =="
ck 401 "$(code -X POST $B/api/space -H 'Content-Type: application/json' -d "{\"name\":\"$A\",\"pin\":\"0000\"}")" "重名 + 错口令 → 401"
R=$(J "$JB" "{\"name\":\"$A\",\"pin\":\"1234\"}"); echo "$R" | grep -q '"existed":true' && { echo "  ✅ 重名 + 对口令 → 进入已有空间"; PASS=$((PASS+1)); } || { echo "  ❌ 重名 + 对口令进不去"; FAIL=$((FAIL+1)); }
J "$JC" "{\"name\":\"$D\",\"pin\":\"1234\"}" > /dev/null
L=0; for i in $(seq 1 11); do L=$(code -X POST $B/api/space -H 'Content-Type: application/json' -d "{\"name\":\"$D\",\"pin\":\"9999\"}"); done
ck 429 "$L" "连续错口令 11 次 → 429 限速"

echo "== 6. 专属链接令牌进入 / 退出 =="
TK=$(echo "$(J /tmp/mm-jt.txt "{\"name\":\"$A\",\"pin\":\"1234\"}")" | sed -n 's/.*"token":"\([a-f0-9]*\)".*/\1/p')
JD=/tmp/mm-jd.txt; rm -f "$JD"
ck 200 "$(code -c "$JD" -X POST $B/api/space -H 'Content-Type: application/json' -d "{\"token\":\"$TK\"}")" "用令牌进入 → 200"
ck 404 "$(code -X POST $B/api/space -H 'Content-Type: application/json' -d '{"token":"deadbeefdeadbeefdeadbeefdeadbeef"}')" "乱令牌 → 404"
ck 200 "$(code -c "$JD" -b "$JD" -X POST $B/api/space/leave)" "退出空间 → 200"
ck 401 "$(code -b "$JD" $B/api/files)" "退出后再读 → 401"

echo
echo "结果：$PASS 通过 / $FAIL 失败"
[ "$FAIL" -eq 0 ] || exit 1
