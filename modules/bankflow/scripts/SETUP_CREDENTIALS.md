# 飞书凭证配置（用于验证 ritos_btr 数据）

验证脚本 `verify_sheet_data.py` 和 `get_sheet_id.py` 需要飞书 App ID 和 App Secret。

## 方式一：从 n8n 复制（推荐）

1. 打开 n8n：http://localhost:55000
2. 设置 → 凭证 → 找到 **Lark Tenant Token account**
3. 点击编辑，复制 **App ID** 和 **App Secret**
4. 在项目根目录创建 `.feishu_credentials`：

```
FEISHU_APP_ID=cli_你复制的AppID
FEISHU_APP_SECRET=你复制的AppSecret
```

## 方式二：n8n CLI 导出（若 n8n 以 CLI 运行）

```bash
n8n export:credentials --id=Lz26C3R1stieAgnP --decrypted --output=cred.json
# 从 cred.json 中提取 app_id、app_secret 填入 .feishu_credentials
```

## 方式三：环境变量

```bash
export FEISHU_APP_ID=cli_xxx FEISHU_APP_SECRET=xxx
python3 scripts/verify_sheet_data.py
```

## 配置完成后

```bash
python3 scripts/verify_sheet_data.py
# 或
python3 scripts/run_full_test.py --verify --sheet --wait 90
```
