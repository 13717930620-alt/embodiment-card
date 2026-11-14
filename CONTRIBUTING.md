# 贡献指南

## 提一张卡片

```bash
npx embodiment-card init <id> > examples/<id>.json
npx embodiment-card check examples/
```

要求：

1. `joints` 必须照抄厂商数据表，不要凭手感估。近似值请在 `provenance.notes` 里写明。
2. `measured` / `reproduced` 必须有 `evidence` 和 `metric`，`metric` 要能被别人复算（写"成功率 0.94"，不要写"效果好"）。
3. `provenance.hash` 用卡片文件本身的 SHA-256：
   ```bash
   node -e "const c=require('crypto'),f=require('fs');console.log('sha256:'+c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" examples/<id>.json
   ```
   注意：加了 hash 之后文件会变，需要再算一次并回填。v1 暂时允许 hash 为空（只影响能否上 L2）。
4. 等级宁低勿高。虚标等级比没有卡片更糟。

## 改规范 / 改分级线

规范字段与 L0–L3 的分级条件是**破坏性变更**，走 RFC：

1. 开一个 issue，标题 `RFC: <一句话>`
2. 写清三件事：现在的规则漏了什么、新规则长什么样、旧卡片怎么办
3. 至少一周讨论期，之后才动 `schema/` 与 `src/grade.mjs`

新增**可选**字段不算破坏性变更，可以直接提 PR，但要在 issue 里说明为什么其他方案不行。

## 代码

- 零运行时依赖是硬约束。想引入依赖请先开 issue 说服维护者。
- 校验器只做"规范里写死的事"，不要加启发式猜测。
- 报错信息必须能定位：给 `path`，说人话。
- `npm test` 全绿，`node bin/ec.mjs check examples/` 全绿。

## 不接受的 PR

- 把卡片做成某个厂商/某个大脑的私有格式
- 给卡片加"评分排名"式的优劣判断
- 收录模型权重或训练数据
- 没有出处的实测数字
